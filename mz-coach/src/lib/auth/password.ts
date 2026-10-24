import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Format: scrypt:N:r:p:saltBase64:hashBase64
// Trenner ":" statt "$", weil Next.js "$" in .env-Dateien als Variable auflöst.
const KEYLEN = 64;
const DEFAULT = { N: 2 ** 15, r: 8, p: 1 };

function scryptAsync(
  password: string,
  salt: Buffer,
  N: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, { N, r, p, maxmem: 256 * N * r }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const { N, r, p } = DEFAULT;
  const hash = await scryptAsync(password, salt, N, r, p);
  return ["scrypt", N, r, p, salt.toString("base64"), hash.toString("base64")].join(":");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  if (expected.length !== KEYLEN) return false;
  const actual = await scryptAsync(
    password,
    Buffer.from(saltB64, "base64"),
    Number(n),
    Number(r),
    Number(p),
  );
  return timingSafeEqual(actual, expected);
}
