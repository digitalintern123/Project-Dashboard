import { describe, expect, it } from 'vitest';
import { listenTarget } from '../src/listen.js';

describe('listenTarget', () => {
  it('uses the named pipe iisnode passes in PORT, with no host', () => {
    expect(listenTarget({ PORT: '\\\\.\\pipe\\0a1b2c3d' })).toEqual({ pipe: '\\\\.\\pipe\\0a1b2c3d' });
  });

  it('prefers API_PORT and binds HOST for numeric ports', () => {
    expect(listenTarget({ API_PORT: '5001', HOST: '127.0.0.1', PORT: '8080' })).toEqual({
      port: 5001,
      host: '127.0.0.1',
    });
  });

  it('uses a numeric PORT only in production, and never the Vite port', () => {
    expect(listenTarget({ NODE_ENV: 'production', PORT: '8080' })).toEqual({ port: 8080, host: '0.0.0.0' });
    expect(listenTarget({ NODE_ENV: 'development', PORT: '8080' })).toEqual({ port: 5000, host: '0.0.0.0' });
    expect(listenTarget({ NODE_ENV: 'production', PORT: '5173' })).toEqual({ port: 5000, host: '0.0.0.0' });
  });
});
