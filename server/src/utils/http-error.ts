/** An error that becomes an HTTP response with this status and message. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`);
export const badRequest = (message: string) => new HttpError(400, message);
export const forbidden = (message: string) => new HttpError(403, message);
export const conflict = (message: string) => new HttpError(409, message);
