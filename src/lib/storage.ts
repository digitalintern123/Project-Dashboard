/**
 * localStorage access that never throws.
 *
 * Safari private mode, embedded webviews, and "block third-party cookies"
 * all make `localStorage` either unavailable or write-blocked. Reading it
 * directly inside a useState initialiser (as this app used to) turns that
 * into a blank screen, so every access goes through here.
 */

function getStore(): Storage | null {
  try {
    const probe = '__encalm_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

let cachedStore: Storage | null | undefined;

function store(): Storage | null {
  if (cachedStore === undefined) cachedStore = getStore();
  return cachedStore;
}

export function readItem(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Returns false when the write was rejected (quota exceeded, storage blocked). */
export function writeItem(key: string, value: string): boolean {
  try {
    const target = store();
    if (!target) return false;
    target.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {
    /* nothing to do — the value is already unreachable */
  }
}

export function readJson<T>(key: string): T | null {
  const raw = readItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    return writeItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
