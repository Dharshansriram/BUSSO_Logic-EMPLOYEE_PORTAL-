import crypto from "node:crypto";

// scrypt defaults (N=16384, r=8, p=1, 64-byte key) match the hashes already stored
// by earlier versions of the app, so existing accounts keep working.
const KEY_LENGTH = 64;

export function hashPassword(
  password,
  salt = crypto.randomBytes(16).toString("hex")
) {
  const derived = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  const [salt, expected, ...rest] = String(stored || "").split(":");
  if (!salt || !expected || rest.length) return false;
  try {
    const actual = Buffer.from(
      crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex")
    );
    const wanted = Buffer.from(expected);
    return (
      actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted)
    );
  } catch {
    return false;
  }
}

export const sha256 = value =>
  crypto.createHash("sha256").update(value).digest("hex");
export const randomToken = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");
