/**
 * Where the HTTP server listens. Normally a TCP port on HOST. Under iisnode
 * (Plesk on Windows) PORT holds a named pipe such as \\.\pipe\abc123 instead of
 * a number; a pipe takes no host, so it is used as-is.
 */
export type ListenTarget = { pipe: string } | { port: number; host: string };

export function listenTarget(env: NodeJS.ProcessEnv = process.env): ListenTarget {
  const rawPort = env.PORT?.trim();
  if (rawPort && !/^\d+$/.test(rawPort)) return { pipe: rawPort };

  const isProduction = env.NODE_ENV === 'production';
  const port = Number(
    env.API_PORT || env.BACKEND_PORT || (isProduction && rawPort && rawPort !== '5173' ? rawPort : 5000),
  );
  // Behind Nginx set HOST=127.0.0.1 so the app port is not reachable from outside.
  return { port, host: env.HOST || '0.0.0.0' };
}
