/**
 * Helpers for recording the tutorial video.
 *
 * Frames come from the DevTools screencast (sharp 1920x1080 JPEGs), not
 * Playwright's recordVideo (low bitrate, blurry text). Each chapter is split
 * into narration beats: a beat runs its on-screen action, then holds until
 * the beat's length has passed. Actual beat start times are saved so
 * subtitles and voice line up with the picture. An action that runs well past
 * its sentence is reported, because then picture and narration drift apart.
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
type Chapter = { id: string; title: string; beats: Beat[] };

export function chapter(id: string): Chapter {
  const all: Chapter[] = JSON.parse(fs.readFileSync(path.join(VIDEO, 'script.json'), 'utf8'));
  const found = all.find((c) => c.id === id);
  if (!found) throw new Error(`no chapter ${id} in script.json; run parse-script.cjs`);
  return found;
}

/** Real voice clip lengths, once they exist; otherwise the word-count estimate. */
function beatLength(id: string, i: number, est: number) {
  const f = path.join(VIDEO, 'audio', 'durations.json');
  if (!fs.existsSync(f)) return est;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  return (d[`${id}-${i}`] ?? est) + 0.45; // short breath between sentences
}

/** Role badges, one per part of the video. */
export const BADGES = {
  coordinator: { text: 'PROJECT COORDINATOR VIEW · Priya Sharma', bg: '#173e49', fg: '#e6c58a' },
  lead: { text: 'PROJECT LEAD VIEW · Rahul Mehta', bg: '#c9a04e', fg: '#173e49' },
} as const;

/** Runs in the page on every navigation: cursor, highlight box, role badge; hides the bundled demo users and the
 * sample HOD, so only the two personas appear in people lists. */
const PAGE_SETUP = (badge: { text: string; bg: string; fg: string } | null) => {
  const ready = () => {
    if (document.getElementById('__cur')) return;
    const cur = document.createElement('div');
    cur.id = '__cur';
    cur.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.4-6.8L4 20z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const saved = JSON.parse(sessionStorage.getItem('__cur') || '{"x":720,"y":420}');
    // The arrow's tip sits 4px right and 2px down from the box corner.
    cur.style.cssText = `position:fixed;left:${saved.x - 4}px;top:${saved.y - 2}px;z-index:2147483647;pointer-events:none;transition:left .6s cubic-bezier(.4,0,.2,1),top .6s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))`;
    document.body.appendChild(cur);
    const box = document.createElement('div');
    box.id = '__hl';
    box.style.cssText =
      'position:fixed;z-index:2147483646;pointer-events:none;border:3px solid #E4572E;border-radius:12px;box-shadow:0 0 0 4px rgba(228,87,46,.18);opacity:0;transition:opacity .3s';
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
    follow();
    if (badge) {
      const b = document.createElement('div');
      b.id = '__badge';
      b.textContent = badge.text;
      b.style.cssText = `position:fixed;right:22px;top:78px;z-index:2147482000;pointer-events:none;background:${badge.bg};color:${badge.fg};font:700 12px/1 Inter,Arial,sans-serif;letter-spacing:.12em;padding:9px 14px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.18)`;
      document.body.appendChild(b);
    }
  };
  const hide = () => {
    for (const el of Array.from(document.querySelectorAll('button, li, [role=option], label'))) {
      const t = el.textContent || '';
      if (t.length < 200 && /hod@encalm\.com|digital\.intern@encalm\.com|anita\.desai@encalm\.com/.test(t))
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

type Who = keyof typeof E2E_USERS;

export class Recorder {
  page!: Page;
  private cdp!: CDPSession;
  private frames: { ts: number; data: Buffer }[] = [];
  private t0 = 0;
  private marks: { i: number; start: number; end: number; text: string; over: number }[] = [];
  private beatIndex = 0;
  constructor(private ch: Chapter) {}

  /** Opens a fresh browser for one chapter, signed in as `who` (if given), with the role badge. */
  static async start(browser: Browser, id: string, who?: Who, badge?: keyof typeof BADGES) {
    const r = new Recorder(chapter(id));
    const context = await browser.newContext({
      baseURL: BASE,
      viewport: { width: 1440, height: 810 },
      deviceScaleFactor: 4 / 3,
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
    });
    if (who) await signIn(context.request, who);
    await context.addInitScript(PAGE_SETUP, badge ? BADGES[badge] : null);
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
    if (!b) throw new Error(`chapter ${this.ch.id} has no beat ${i}`);
    const start = Date.now() / 1000 - this.t0;
    const len = beatLength(this.ch.id, i, b.est);
    await action();
    const took = Date.now() / 1000 - this.t0 - start;
    if (len - took > 0) await this.page.waitForTimeout((len - took) * 1000);
    this.marks.push({ i, start, end: Date.now() / 1000 - this.t0, text: b.text, over: Math.max(0, took - len) });
  }

  async stop() {
    if (this.beatIndex !== this.ch.beats.length)
      throw new Error(`chapter ${this.ch.id}: ran ${this.beatIndex} of ${this.ch.beats.length} beats`);
    await unpop(this.page).catch(() => {});
    await this.page.waitForTimeout(500);
    const end = Date.now() / 1000;
    await this.cdp.send('Page.stopScreencast');
    const dir = path.join(VIDEO, 'rec', this.ch.id);
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
      JSON.stringify({ id: this.ch.id, title: this.ch.title, length: end - this.t0, beats: this.marks }, null, 2),
    );
    await this.page.context().close();
    // Picture and narration drift apart when an action runs well past its sentence.
    const late = this.marks.filter((m) => m.over > 1);
    if (late.length) {
      throw new Error(
        `${this.ch.id}: actions ran past their narration: ${late.map((m) => `beat ${m.i} +${m.over.toFixed(1)}s`).join(', ')}`,
      );
    }
  }
}

/** Signs a request context in; Rahul uses his new password once he has set it in Part 2, step 1. */
export async function signIn(request: Page['request'], who: Who) {
  const u = E2E_USERS[who] as { email: string; password: string; newPassword?: string };
  // The new password first: failed attempts count towards the account lockout.
  for (const password of [u.newPassword, u.password].filter(Boolean) as string[]) {
    const res = await request.post(`${BASE}/api/auth/login`, { headers: H, data: { email: u.email, password } });
    if (res.status() === 200) return;
  }
  throw new Error(`could not sign in as ${who}`);
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
  await unpop(page);
  await loc.first().evaluate((el, off) => {
    const y = el.getBoundingClientRect().top + window.scrollY - off;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }, offset);
  await page.waitForTimeout(900);
}

export async function scrollTop(page: Page) {
  await hlOff(page);
  await unpop(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(800);
}

/** Glides the cursor onto the element and returns the point it points at, relative to the element. */
export async function moveTo(page: Page, loc: Locator) {
  await loc.first().scrollIntoViewIfNeeded();
  const b = await box(loc);
  const dx = Math.round(Math.min(b.w / 2, 60));
  const dy = Math.round(b.h / 2);
  await page.evaluate(
    ([x, y]) => {
      const c = document.getElementById('__cur');
      if (c) {
        c.style.left = `${x - 4}px`;
        c.style.top = `${y - 2}px`;
      }
      sessionStorage.setItem('__cur', JSON.stringify({ x, y }));
    },
    [b.x + dx, b.y + dy],
  );
  await page.waitForTimeout(700);
  return { x: dx, y: dy };
}

/** Moves the cursor onto the element, then clicks exactly where the cursor points. */
export async function click(page: Page, loc: Locator) {
  await unpop(page);
  const at = await moveTo(page, loc);
  await page.evaluate(() => {
    const c = document.getElementById('__cur');
    if (!c) return;
    const ring = document.createElement('div');
    ring.style.cssText = `position:fixed;left:${parseFloat(c.style.left) - 8}px;top:${parseFloat(c.style.top) - 10}px;width:24px;height:24px;border-radius:50%;border:3px solid #E4572E;z-index:2147483647;pointer-events:none;transition:transform .45s,opacity .45s`;
    document.body.appendChild(ring);
    requestAnimationFrame(() => {
      ring.style.transform = 'scale(1.8)';
      ring.style.opacity = '0';
    });
    setTimeout(() => ring.remove(), 500);
  });
  await loc.first().click({ position: at });
  await page.waitForTimeout(450);
}

export async function type(page: Page, loc: Locator, text: string, delay = 45) {
  await click(page, loc);
  await loc.first().pressSequentially(text, { delay });
  await page.waitForTimeout(250);
}

/** Replaces a field's value, typing the new one. */
export async function retype(page: Page, loc: Locator, text: string, delay = 110) {
  await click(page, loc);
  await loc.first().fill('');
  await loc.first().pressSequentially(text, { delay });
  await page.waitForTimeout(300);
}

export async function pick(page: Page, loc: Locator, option: string | { label: string }) {
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

/**
 * Pop-out: dims the screen, lifts an enlarged copy of the element (a parent
 * `up` levels above, if given) above the dimming, and shows `label` beside it.
 * The copy is static, so pop out what is being explained, not what is being typed.
 */
export async function pop(page: Page, loc: Locator, label: string, opts: { up?: number; scale?: number } = {}) {
  await hlOff(page);
  await unpop(page);
  await loc.first().scrollIntoViewIfNeeded();
  // An area whose enlarged copy would run off the top or bottom of the screen is
  // scrolled to the middle first. The menu and top bar are fixed, so they stay.
  const moved = await loc.first().evaluate((el, up) => {
    let node = el as HTMLElement;
    for (let i = 0; i < up && node.parentElement; i++) node = node.parentElement;
    for (let n: HTMLElement | null = node; n; n = n.parentElement)
      if (/fixed|sticky/.test(getComputedStyle(n).position)) return false;
    const r = node.getBoundingClientRect();
    const grow = r.height * 0.07;
    if (r.top - grow >= 8 && r.bottom + grow <= innerHeight - 8) return false;
    const want = r.height + 2 * grow > innerHeight - 100 ? r.top - grow - 50 : r.top + r.height / 2 - innerHeight / 2;
    const max = document.documentElement.scrollHeight - innerHeight;
    const to = Math.max(0, Math.min(max, scrollY + want));
    if (Math.abs(to - scrollY) < 4) return false;
    window.scrollTo({ top: to, behavior: 'smooth' });
    return true;
  }, opts.up ?? 0);
  await page.waitForTimeout(moved ? 650 : 150);
  await loc.first().evaluate(
    (el, [up, label, scaleWanted]) => {
      let node = el as HTMLElement;
      for (let i = 0; i < (up as number) && node.parentElement; i++) node = node.parentElement;
      const r = node.getBoundingClientRect();
      // The copy needs a background: the nearest one that isn't transparent.
      let bg = 'rgba(0, 0, 0, 0)';
      for (let n: HTMLElement | null = node; n && /rgba\(0, 0, 0, 0\)|transparent/.test(bg); n = n.parentElement)
        bg = getComputedStyle(n).backgroundColor;
      if (/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) bg = '#fbfaf6';
      const copy = node.cloneNode(true) as HTMLElement;
      const from = [node, ...Array.from(node.querySelectorAll('input,select,textarea'))] as HTMLInputElement[];
      const to = [copy, ...Array.from(copy.querySelectorAll('input,select,textarea'))] as HTMLInputElement[];
      from.forEach((f, k) => {
        if ('value' in f && to[k]) {
          to[k].value = f.value;
          if (f.checked) to[k].checked = true;
        }
      });
      const big = r.width > 900 || r.height > 420;
      const scale = (scaleWanted as number) || (big ? 1.025 : r.width > 480 ? 1.06 : 1.12);
      copy.style.cssText += `;position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;box-sizing:border-box;z-index:2147483001;background:${bg};border-radius:12px;overflow:hidden;pointer-events:none;transform-origin:center;transform:scale(1);transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s;box-shadow:0 0 0 3px #E4572E`;
      const dim = document.createElement('div');
      dim.style.cssText =
        'position:fixed;inset:0;background:rgba(10,24,30,.58);z-index:2147483000;opacity:0;transition:opacity .35s;pointer-events:none';
      const tag = document.createElement('div');
      tag.textContent = label as string;
      const below = r.bottom * scale + 70 < innerHeight;
      tag.style.cssText = `position:fixed;z-index:2147483002;pointer-events:none;background:#E4572E;color:#fff;font:700 17px/1.2 Inter,Arial,sans-serif;padding:10px 16px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);opacity:0;transition:opacity .35s;max-width:520px;white-space:nowrap`;
      document.body.append(dim, copy, tag);
      const tw = tag.getBoundingClientRect().width;
      const cx = r.left + r.width / 2;
      tag.style.left = `${Math.max(16, Math.min(innerWidth - tw - 16, cx - tw / 2))}px`;
      const grow = ((scale - 1) * r.height) / 2;
      tag.style.top = below ? `${r.bottom + grow + 16}px` : `${Math.max(12, r.top - grow - 58)}px`;
      requestAnimationFrame(() => {
        dim.style.opacity = '1';
        tag.style.opacity = '1';
        copy.style.transform = `scale(${scale})`;
        copy.style.boxShadow = '0 0 0 3px #E4572E, 0 22px 60px rgba(0,0,0,.5)';
      });
      Object.assign(window, {
        __unpop: () => {
          dim.remove();
          copy.remove();
          tag.remove();
        },
      });
    },
    [opts.up ?? 0, label, opts.scale ?? 0] as const,
  );
  await page.waitForTimeout(500);
}

export async function unpop(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __unpop?: (() => void) | null };
    w.__unpop?.();
    w.__unpop = null;
  });
}

/** A pop-out card with the stage bar colours, drawn over the page (matches src/lib/progress-tone.ts). */
export async function legend(page: Page) {
  await unpop(page);
  await page.evaluate(() => {
    const rows: [string, string][] = [
      ['#3d9a7e', 'Green — ahead of schedule, or complete'],
      ['#e3b53c', 'Yellow — work in progress, on track'],
      ['#d66254', 'Red — delayed or blocked'],
    ];
    const dim = document.createElement('div');
    dim.style.cssText =
      'position:fixed;inset:0;background:rgba(10,24,30,.58);z-index:2147483000;opacity:0;transition:opacity .35s;pointer-events:none';
    const card = document.createElement('div');
    card.style.cssText =
      'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.96);z-index:2147483001;background:#fffdf8;border-radius:16px;padding:26px 32px;box-shadow:0 0 0 3px #E4572E,0 22px 60px rgba(0,0,0,.5);font:15px/1.4 Inter,Arial,sans-serif;color:#173e49;opacity:0;transition:opacity .35s,transform .35s;pointer-events:none;min-width:520px';
    card.innerHTML =
      '<div style="font:700 12px Inter;letter-spacing:.18em;color:#9a711f;margin-bottom:6px">STAGE & PROJECT BARS</div><div style="font:700 22px Inter;margin-bottom:16px">What the colours mean</div>' +
      rows
        .map(
          ([c, t]) =>
            `<div style="display:flex;align-items:center;gap:14px;margin:10px 0"><span style="width:90px;height:10px;border-radius:6px;background:${c}"></span><span>${t}</span></div>`,
        )
        .join('');
    document.body.append(dim, card);
    requestAnimationFrame(() => {
      dim.style.opacity = '1';
      card.style.opacity = '1';
      card.style.transform = 'translate(-50%,-50%) scale(1)';
    });
    Object.assign(window, {
      __unpop: () => {
        dim.remove();
        card.remove();
      },
    });
  });
  await page.waitForTimeout(500);
}

export const tab = (page: Page, name: RegExp) => page.getByRole('button', { name }).first();
