import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

type Schemas = { body?: z.ZodType; params?: z.ZodType; query?: z.ZodType };

/**
 * Validates request params, query and body against zod schemas. Invalid input is
 * rejected with 400 and a list of field errors. Validated body values replace
 * req.body, so unknown fields are dropped before the handler runs.
 */
export function validate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: { field: string; message: string }[] = [];
    const parts = ['params', 'query', 'body'] as const;
    const parsed: Partial<Record<(typeof parts)[number], unknown>> = {};

    for (const part of parts) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(part === 'body' ? (req.body ?? {}) : req[part]);
      if (result.success) {
        parsed[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          errors.push({ field: [part, ...issue.path.map(String)].join('.'), message: issue.message });
        }
      }
    }

    if (errors.length > 0) {
      const first = errors[0];
      return res.status(400).json({
        error: `Invalid ${first.field.replace(/^(body|params|query)\./, '')}: ${first.message}`,
        fields: errors.slice(0, 20),
      });
    }

    if (parsed.body !== undefined) req.body = parsed.body;
    // req.query is a getter in Express 5; keep the original object but it has been checked.
    next();
  };
}
