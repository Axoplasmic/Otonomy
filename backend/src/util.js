// Wraps a route handler so thrown errors reach the error middleware.
export const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Validates req.body against a zod schema, returning parsed data or a 400.
export function validate(schema, req, res) {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
    return null;
  }
  return result.data;
}

// Strips password_hash before sending a user object to a client.
export function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}
