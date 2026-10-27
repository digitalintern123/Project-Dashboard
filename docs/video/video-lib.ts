/**
 * Helpers for recording the tutorial video.
 *
 * Frames come from the DevTools screencast (sharp 1920x1080 JPEGs), not
 * Playwright's recordVideo (low bitrate, blurry text). Each chapter is split
 * into narration beats: a beat runs its on-screen action, then waits until
 * the beat's target length has passed. Actual beat start times are saved so
 * subtitles and voice line up with the picture even if an action overruns.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, CDPSession, Locator, Page } from '@playwright/test';
import { E2E_USERS } from './users.mjs';

/** This folder, and the git-ignored folder all generated files go to. */
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VIDEO = path.join(HERE, '.out');
export const BASE = 'http://localhost:5073';
const H = { 'X-Requested-With': 'XMLHttpRequest' };

type Beat = { text: string; est: number };
type Chapter = { n: number; title: string; beats: Beat[] };

export function chapter(n: number): Chapter {
  const all: Chapter[] = JSON.parse(fs.readFileSync(path.join(VIDEO, 'script.json'), 'utf8'));
  return all.find((c) => c.n === n)!;
}

/** Real voice clip lengths, once they exist; otherwise the word-count estimate. */
function beatLength(n: number, i: number, est: number) {
  const f = path.join(VIDEO, 'audio', 'durations.json');
  if (!fs.existsSync(f)) return est;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  return (d[`${n}-${i}`] ?? est) + 0.45; // short breath between sentences
}

/** Runs in the page on every navigation: cursor, highlight box, hides bundled demo users. */
const PAGE_SETUP = () => {
  const ready = () => {
    if (document.getElementById('__cur')) return;
    const cur = document.createElement('div');
    cur.id = '__cur';
    cur.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.4-6.8L4 20z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const saved = JSON.parse(sessionStorage.getItem('__cur') || '{"x":720,"y":420}');
    cur.style.cssText = `position:fixed;left:${saved.x}px;top:${saved.y}px;z-index:2147483647;pointer-events:none;transition:left .65s cubic-bezier(.4,0,.2,1),top .65s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))`;
    document.body.appendChild(cur);
    const box = document.createElement('div');
    box.id = '__hl';
    box.style.cssText =
      'position:fixed;z-index:2147483646;pointer-events:none;border:3px solid #E4572E;border-radius:12px;box-shadow:0 0 0 4px rgba(228,87,46,.18);opacity:0;transition:opacity .3s,left .3s,top .3s,width .3s,height .3s';
    document.body.appendChild(box);
    const w = window as unknown as { __hlEl?: Element | null; __hlPad?: number };
    const follow = () => {
      const el = w.__hlEl;
      if (el && el.isConnected) {
        const r = el.getBoundingClientRect();
        const pad = w.__hlPad ?? 6;
        Object.assign(box.style, {
          left: `${r.left - pad}px`,
          top: `${r.top - pad}px`,
          width: `${r.width + pad * 2}px`,
          height: `${r.height + pad * 2}px`,
          opacity: '1',
        });
      } else box.style.opacity = '0';
      requestAnimationFrame(follow);
    };
    box.style.transition = 'opacity .3s';
    follow();
  };
  const hide = () => {
    for (const el of Array.from(document.querySelectorAll('button, li, [role=option], label'))) {
      const t = el.textContent || '';
      if (t.length < 200 && /hod@encalm\.com|digital\.intern@encalm\.com/.test(t))
        (el as HTMLElement).style.display = 'none';
    }
  };
  const go = () => {
    ready();
    hide();
    new MutationObserver(hide).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) go();
  else document.addEventListener('DOMContentLoaded', go);
};

export class Recorder {
  page!: Page;
  private cdp!: CDPSession;
  private frames: { ts: number; data: Buffer }[] = [];
  private t0 = 0;
  private marks: { i: number; start: number; end: number; text: string }[] = [];
  private beatIndex = 0;
  constructor(private ch: Chapter) {}

  static async start(browser: Browser, n: number, who?: keyof typeof E2E_USERS) {
    const r = new Recorder(chapter(n));
    const context = await browser.newContext({
      baseURL: BASE,
      viewport: { width: 1440, height: 810 },
      deviceScaleFactor: 4 / 3,
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
    });
    if (who) {
      const u = E2E_USERS[who];
      const res = await context.request.post('/api/auth/login', {
        headers: H,
        data: { email: u.email, password: u.password },
      });
      if (res.status() !== 200) throw new Error(`login ${who}: ${res.status()}`);
    }
    await context.addInitScript(PAGE_SETUP);
    r.page = await context.newPage();
    return r;
  }

  /** Starts capturing. Call once the first screen has loaded. */
  async rec() {
    await this.page.waitForTimeout(400);
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', async (f) => {
      this.frames.push({ ts: f.metadata.timestamp ?? Date.now() / 1000, data: Buffer.from(f.data, 'base64') });
      await this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 92,
      maxWidth: 1920,
      maxHeight: 1080,
      everyNthFrame: 1,
    });
    this.t0 = Date.now() / 1000;
    await this.page.waitForTimeout(300);
  }

  /** One narration sentence: run `action`, then hold until the sentence's length has passed. */
  async beat(action: () => Promise<unknown> = async () => {}) {
    const i = this.beatIndex++;
    const b = this.ch.beats[i];
    if (!b) throw new Error(`chapter ${this.ch.n} has no beat ${i}`);
    const start = Date.now() / 1000 - this.t0;
    const len = beatLength(this.ch.n, i, b.est);
    await action();
    const left = len - (Date.now() / 1000 - this.t0 - start);
    if (left > 0) await this.page.waitForTimeout(left * 1000);
    this.marks.push({ i, start, end: Date.now() / 1000 - this.t0, text: b.text });
  }

  async stop() {
    if (this.beatIndex !== this.ch.beats.length)
      throw new Error(`chapter ${this.ch.n}: ran ${this.beatIndex} of ${this.ch.beats.length} beats`);
    await this.page.waitForTimeout(500);
    const end = Date.now() / 1000;
    await this.cdp.send('Page.stopScreencast');
    const dir = path.join(VIDEO, 'rec', `ch${String(this.ch.n).padStart(2, '0')}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    // Frames arrive only when the screen changes; each one lasts until the next.
    const frames = this.frames.filter((f) => f.ts >= this.t0 - 0.05);
    const first = this.frames.filter((f) => f.ts < this.t0).pop();
    if (first) frames.unshift({ ...first, ts: this.t0 });
    let list = '';
    frames.forEach((f, k) => {
      const name = `f${String(k).padStart(5, '0')}.jpg`;
      fs.writeFileSync(path.join(dir, name), f.data);
      const next = k + 1 < frames.length ? frames[k + 1].ts : end;
      list += `file '${name}'\nduration ${Math.max(0.001, next - Math.max(f.ts, this.t0)).toFixed(4)}\n`;
    });
    list += `file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
    fs.writeFileSync(path.join(dir, 'frames.txt'), list);
    fs.writeFileSync(
      path.join(dir, 'meta.json'),
      JSON.stringify({ n: this.ch.n, title: this.ch.title, length: end - this.t0, beats: this.marks }, null, 2),
    );
    await this.page.context().close();
  }
}

// ---------- On-screen actions ----------

async function box(loc: Locator, up = 0) {
  return loc.first().evaluate((el, up) => {
    let node: Element = el;
    for (let i = 0; i < up && node.parentElement; i++) node = node.parentElement;
    const r = node.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, up);
}

/** Smoothly scrolls so the element sits `offset` px below the top. */
export async function scrollTo(page: Page, loc: Locator, offset = 120) {
  await hlOff(page);
  await loc.first().evaluate((el, off) => {
    const y = el.getBoundingClientRect().top + window.scrollY - off;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }, offset);
  await page.waitForTimeout(900);
}

export async function scrollTop(page: Page) {
  await hlOff(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(800);
}

export async function moveTo(page: Page, loc: Locator) {
  await loc.first().scrollIntoViewIfNeeded();
  const b = await box(loc);
  const x = b.x + Math.min(b.w / 2, 60);
  const y = b.y + b.h / 2;
  await page.evaluate(
    ([x, y]) => {
      const c = document.getElementById('__cur');
      if (c) {
        c.style.left = `${x - 4}px`;
        c.style.top = `${y - 3}px`;
      }
      sessionStorage.setItem('__cur', JSON.stringify({ x: x - 4, y: y - 3 }));
    },
    [x, y],
  );
  await page.waitForTimeout(700);
}

export async function click(page: Page, loc: Locator) {
  await moveTo(page, loc);
  await page.evaluate(() => {
    const c = document.getElementById('__cur');
    if (!c) return;
    const ring = document.createElement('div');
    ring.style.cssText = `position:fixed;left:${parseFloat(c.style.left) - 10}px;top:${parseFloat(c.style.top) - 10}px;width:24px;height:24px;border-radius:50%;border:3px solid #E4572E;z-index:2147483647;pointer-events:none;transition:transform .45s,opacity .45s`;
    document.body.appendChild(ring);
    requestAnimationFrame(() => {
      ring.style.transform = 'scale(1.8)';
      ring.style.opacity = '0';
    });
    setTimeout(() => ring.remove(), 500);
  });
  await loc.first().click();
  await page.waitForTimeout(450);
}

export async function type(page: Page, loc: Locator, text: string, delay = 45) {
  await click(page, loc);
  await loc.first().pressSequentially(text, { delay });
  await page.waitForTimeout(250);
}

export async function pick(page: Page, loc: Locator, option: string) {
  await click(page, loc);
  await loc.first().selectOption(option);
  await page.waitForTimeout(400);
}

/** Draws the orange box around an element (optionally a parent `up` levels above). */
export async function hl(page: Page, loc: Locator, opts: { up?: number; pad?: number; move?: boolean } = {}) {
  await loc.first().scrollIntoViewIfNeeded();
  if (opts.move !== false) await moveTo(page, loc);
  await loc.first().evaluate(
    (el, [up, pad]) => {
      let node: Element = el;
      for (let i = 0; i < up && node.parentElement; i++) node = node.parentElement;
      Object.assign(window, { __hlEl: node, __hlPad: pad });
    },
    [opts.up ?? 0, opts.pad ?? 6],
  );
  await page.waitForTimeout(400);
}

export async function hlOff(page: Page) {
  await page.evaluate(() => Object.assign(window, { __hlEl: null }));
}

export const tab = (page: Page, name: RegExp) => page.getByRole('button', { name }).first();
