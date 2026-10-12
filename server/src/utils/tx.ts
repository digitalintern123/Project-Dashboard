import type { NextFunction, Request, Response } from 'express';
import { db } from '../db/database.js';

let afterCommitQueue: (() => void)[] | null = null;

/**
 * Runs `fn` once the current transaction commits (immediately if there is no
 * transaction). Use for side effects that must not happen if the change rolls
 * back: writing the JSON snapshot, deleting files from disk.
 */
export function afterCommit(fn: () => void): void {
  if (afterCommitQueue) afterCommitQueue.push(fn);
  else fn();
}

/**
 * Wraps a route handler so all of its database writes (the change itself,
 * notifications, queued emails, the audit entry) commit together or not at all.
 * The handler must be synchronous: better-sqlite3 transactions cannot span an await.
 */
export function transactional<Req extends Request = Request>(handler: (req: Req, res: Response) => unknown) {
  return (req: Req, res: Response, next: NextFunction) => {
    const callbacks: (() => void)[] = [];
    afterCommitQueue = callbacks;
    try {
      db.transaction(() => {
        const result = handler(req, res);
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          throw new Error('transactional() handlers must be synchronous');
        }
      })();
    } catch (err) {
      return next(err);
    } finally {
      afterCommitQueue = null;
    }
    for (const fn of callbacks) {
      try {
        fn();
      } catch (err) {
        console.error('[afterCommit]', err);
      }
    }
  };
}
