import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';

afterEach(() => vi.unstubAllGlobals());

const capture = () => {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ project: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return calls;
};

describe('requests the hosting firewall would block', () => {
  it('sends PATCH as POST with the real method in X-HTTP-Method-Override', async () => {
    const calls = capture();
    await api.phases.update('p1', 'ph1', { progress: 67 });
    expect(calls[0].url).toBe('/api/projects/p1/phases/ph1');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['X-HTTP-Method-Override']).toBe('PATCH');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ progress: 67 });
  });

  it('sends DELETE as POST, and leaves GET and POST alone', async () => {
    const calls = capture();
    await api.phases.delete('p1', 'ph1');
    await api.projects.getAll();
    await api.phases.add('p1', { name: 'X' });
    expect(
      calls.map((c) => [c.init.method ?? 'GET', (c.init.headers as Record<string, string>)['X-HTTP-Method-Override']]),
    ).toEqual([
      ['POST', 'DELETE'],
      ['GET', undefined],
      ['POST', undefined],
    ]);
  });
});
