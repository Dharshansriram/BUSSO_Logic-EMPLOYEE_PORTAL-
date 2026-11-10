// Small in-memory limiter (per process). Use a shared store (Redis) if you run several instances.
const buckets = new Map();

export function hit(key, max, windowMs) {
  const now = Date.now();
  const bucket = (buckets.get(key) ?? []).filter(t => now - t < windowMs);
  bucket.push(now);
  buckets.set(key, bucket);
  if (buckets.size > 10_000)
    for (const [k, v] of buckets) if (!v.some(t => now - t < windowMs)) buckets.delete(k);
  return bucket.length <= max;
}
export const count = (key, windowMs) =>
  (buckets.get(key) ?? []).filter(t => Date.now() - t < windowMs).length;
export const clear = key => buckets.delete(key);
export const resetAllLimits = () => buckets.clear();

/** Express middleware: at most `max` requests per `windowMs` per client IP and bucket name. */
export const rateLimit = (name, max, windowMs) => (req, res, next) =>
  hit(`${name}:${req.ip}`, max, windowMs)
    ? next()
    : res
        .status(429)
        .json({ error: "Too many attempts. Try again later.", detail: "Too many attempts. Try again later." });
