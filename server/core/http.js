import { ZodError } from "zod";
import { HttpError } from "../../shared/_core/errors.js";

export const httpError = (status, message) => new HttpError(status, message);

/** Express 4 does not catch rejected promises; this forwards them to the error handler. */
export const asyncHandler = handler => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

/** Parse and validate a request body with a zod schema (400 on failure). */
export function parseBody(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join(".") || "body";
    throw httpError(400, `${field}: ${issue.message}`);
  }
  return result.data;
}

/** Parse a positive-integer route parameter. */
export function parseId(value, label = "id") {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 0) throw httpError(400, `Invalid ${label}`);
  return id;
}

export const notFoundHandler = (req, res) =>
  res
    .status(404)
    .json({
      error: `Not found: ${req.method} ${req.originalUrl}`,
      detail: "Not found",
    });

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return;
  const status =
    error instanceof HttpError
      ? error.statusCode
      : error instanceof ZodError
        ? 400
        : (error?.status ?? error?.statusCode ?? 500);
  if (status >= 500) console.error("[api]", error);
  const message =
    status >= 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : error.message || "Internal server error";
  // `detail` is what the client reads; `error` is kept for older consumers.
  res.status(status).json({ error: message, detail: message });
}
