import { describe, expect, it } from 'vitest';
import { isInside } from '../src/app.js';

describe('isInside', () => {
  it('detects a data folder inside the public web folder', () => {
    expect(isInside('/srv/app/dist/encalm-data', '/srv/app/dist', 'linux')).toBe(true);
    expect(isInside('/srv/app/dist', '/srv/app/dist', 'linux')).toBe(true);
    expect(isInside('C:\\Site\\httpdocs\\DIST\\encalm-data', 'c:\\site\\httpdocs\\dist', 'win32')).toBe(true);
  });

  it('allows folders outside it', () => {
    expect(isInside('/srv/app/data', '/srv/app/dist', 'linux')).toBe(false);
    expect(isInside('/srv/app/dist-data', '/srv/app/dist', 'linux')).toBe(false);
    expect(isInside('C:\\Site\\encalm-data', 'C:\\Site\\httpdocs\\dist', 'win32')).toBe(false);
  });
});
