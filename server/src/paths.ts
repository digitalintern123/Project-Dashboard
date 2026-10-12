import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Locations on disk, resolved the same way whether the server runs from
 * TypeScript sources (server/src, via tsx) or the compiled bundle (server/dist).
 */

function findProjectRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`Could not find the project root above ${start}`);
    dir = parent;
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));

export const projectRoot = findProjectRoot(here);

/** Default data directory (database, uploads, snapshot) when DATA_DIR is not set. */
export const defaultDataDir = path.join(projectRoot, 'server', 'data');

/** The built SPA served in production. */
export const clientDistDir = path.join(projectRoot, 'dist');

/** SQL migrations: copied next to the bundle by the build, otherwise read from the sources. */
export const migrationsDir = fs.existsSync(path.join(here, 'migrations'))
  ? path.join(here, 'migrations')
  : path.join(projectRoot, 'server', 'src', 'db', 'migrations');
