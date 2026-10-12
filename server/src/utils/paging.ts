export type Page = { limit: number; offset: number };

/**
 * Reads ?limit= and ?offset= (already checked as digits by `pageQuery`).
 * The limit is clamped to 1..max; a missing limit uses the default.
 */
export function pageFrom(query: { limit?: unknown; offset?: unknown }, defaultLimit: number, maxLimit = 200): Page {
  const limit = Number(query.limit ?? defaultLimit);
  const offset = Number(query.offset ?? 0);
  return {
    limit: Math.min(Math.max(Number.isFinite(limit) ? limit : defaultLimit, 1), maxLimit),
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
  };
}
