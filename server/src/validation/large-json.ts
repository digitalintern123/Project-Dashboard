import express from 'express';

/** Paths whose JSON body is parsed by largeJson (after auth) instead of the global 1 MB parser. */
export const LARGE_JSON_PATHS = new Set(['/api/system/import', '/api/projects/sync']);

/** 10 MB JSON parser for full-portfolio imports. Mount only after auth checks. */
export const largeJson = express.json({ limit: '10mb' });
