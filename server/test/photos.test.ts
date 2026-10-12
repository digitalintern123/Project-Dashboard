import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { makeApp, loginAs, insertProject } from './helpers.js';
import { db, uploadsDir } from '../src/db/database.js';

const app = makeApp();
const P = '/api/projects/proj-photo';

let bigJpegWithGps: Buffer;
let smallPng: Buffer;
let gif: Buffer;

beforeAll(async () => {
  insertProject('proj-photo', 'u-lead-a');
  bigJpegWithGps = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#2e7c67' } })
    .jpeg()
    .withExif({ IFD0: { Make: 'TestCam', Model: 'X1' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '28/1 33/1 0/1' } })
    .toBuffer();
  smallPng = await sharp({ create: { width: 300, height: 200, channels: 4, background: '#d6a95d' } })
    .png()
    .toBuffer();
  gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } })
    .gif()
    .toBuffer();
});

function fileOnDisk(url: string) {
  return path.join(uploadsDir, path.basename(url));
}

describe('photo uploads', () => {
  it('re-encodes to WebP (max 2000px) with a 400px thumbnail, strips EXIF and uses UUID names', async () => {
    const lead = await loginAs(app, 'leadA');
    const res = await lead
      .post(`${P}/photos`)
      .field(
        'meta',
        JSON.stringify([{ caption: 'Façade', stage: 'Execution', category: 'Progress', takenDate: '2026-10-01' }, {}]),
      )
      .attach('photos', bigJpegWithGps, 'site.jpg')
      .attach('photos', smallPng, 'plan.png');
    expect(res.status).toBe(201);
    expect(res.body.photos).toHaveLength(2);

    const [first, second] = res.body.photos;
    expect(first.caption).toBe('Façade');
    expect(first.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webp$/);
    expect(first.thumbnailUrl).toMatch(/^\/uploads\/[0-9a-f-]{36}_thumb\.webp$/);
    expect(second.caption).toBe('Site progress photograph');

    const full = await sharp(fs.readFileSync(fileOnDisk(first.url))).metadata();
    expect(full.format).toBe('webp');
    expect(Math.max(full.width!, full.height!)).toBe(2000);
    expect(full.exif).toBeUndefined();

    const thumb = await sharp(fs.readFileSync(fileOnDisk(first.thumbnailUrl))).metadata();
    expect(Math.max(thumb.width!, thumb.height!)).toBe(400);

    // Small images are not enlarged.
    const small = await sharp(fs.readFileSync(fileOnDisk(second.url))).metadata();
    expect(small.width).toBe(300);
  });

  it('rejects files whose bytes are not JPEG/PNG/WebP, whatever their name', async () => {
    const lead = await loginAs(app, 'leadA');
    const fake = await lead.post(`${P}/photos`).attach('photos', Buffer.from('<script>alert(1)</script>'), 'evil.jpg');
    expect(fake.status).toBe(400);
    const gifRes = await lead.post(`${P}/photos`).attach('photos', gif, 'anim.gif');
    expect(gifRes.status).toBe(400);
  });

  it('rejects a batch without writing anything if any file is invalid', async () => {
    const before = fs.readdirSync(uploadsDir).length;
    const lead = await loginAs(app, 'leadA');
    const res = await lead
      .post(`${P}/photos`)
      .attach('photos', smallPng, 'ok.png')
      .attach('photos', Buffer.from('not an image'), 'bad.png');
    expect(res.status).toBe(400);
    expect(fs.readdirSync(uploadsDir).length).toBe(before);
  });

  it('enforces the 10 MB per-file and 20-file limits', async () => {
    const lead = await loginAs(app, 'leadA');
    const tooBig = await lead.post(`${P}/photos`).attach('photos', Buffer.alloc(10 * 1024 * 1024 + 1), 'huge.jpg');
    expect(tooBig.status).toBe(413);

    let req = lead.post(`${P}/photos`);
    for (let i = 0; i < 21; i++) req = req.attach('photos', smallPng, `p${i}.png`);
    expect((await req).status).toBe(400);
  });

  it('requires at least one file', async () => {
    const lead = await loginAs(app, 'leadA');
    expect((await lead.post(`${P}/photos`).send({})).status).toBe(400);
  });
});

describe('serving and deleting uploads', () => {
  it('serves uploads only to signed-in users, with nosniff', async () => {
    const lead = await loginAs(app, 'leadA');
    const up = await lead.post(`${P}/photos`).attach('photos', smallPng, 'a.png');
    const url = up.body.photo.url as string;

    expect((await request(app).get(url)).status).toBe(401);
    const hod = await loginAs(app, 'hod');
    const res = await hod.get(url);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toContain('private');
  });

  it('deletes both image files with the photo', async () => {
    const lead = await loginAs(app, 'leadA');
    const up = await lead.post(`${P}/photos`).attach('photos', smallPng, 'b.png');
    const { id, url, thumbnailUrl } = up.body.photo;
    expect(fs.existsSync(fileOnDisk(url))).toBe(true);

    expect((await lead.delete(`${P}/photos/${id}`)).status).toBe(200);
    expect(fs.existsSync(fileOnDisk(url))).toBe(false);
    expect(fs.existsSync(fileOnDisk(thumbnailUrl))).toBe(false);
    expect(db.prepare('SELECT 1 FROM photos WHERE id = ?').get(id)).toBeUndefined();
  });

  it('removes photo files when the coordinator deletes the project', async () => {
    insertProject('proj-doomed', 'u-lead-a');
    const lead = await loginAs(app, 'leadA');
    const up = await lead.post('/api/projects/proj-doomed/photos').attach('photos', smallPng, 'c.png');
    const { url, thumbnailUrl } = up.body.photo;

    const coord = await loginAs(app, 'coordinator');
    expect((await coord.delete('/api/projects/proj-doomed')).status).toBe(200);
    expect(fs.existsSync(fileOnDisk(url))).toBe(false);
    expect(fs.existsSync(fileOnDisk(thumbnailUrl))).toBe(false);
  });
});
