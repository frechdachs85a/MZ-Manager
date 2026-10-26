import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecretAusDatei } from "./geheimnisse";

// Session-Cookie für den Zugangsschutz der App (ein Nutzer).
// Inhalt: Ablaufzeit in Sekunden, signiert mit HMAC-SHA256.
// Kein Geheimnis im Cookie, nur die Signatur beweist die Anmeldung.

export const SESSION_COOKIE = "mzc_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

// Aus der Umgebungsvariable SESSION_SECRET, sonst aus geheimnisse.json auf dem Laufwerk (beim ersten Start erzeugt)
let ausDatei: string | null = null;
// Sitzungs-Schlüssel aus Umgebung oder Datei
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || (ausDatei ??= sessionSecretAusDatei());
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET ist kürzer als 32 Zeichen");
  }
  return secret;
}

// Signiertes Sitzungs-Token mit Ablaufzeit
export function createSessionToken(secret: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + SESSION_MAX_AGE;
  const payload = `v1.${exp}`;
  return `${payload}.${sign(payload, secret)}`;
}

// Sitzungs-Token prüfen (Signatur und Ablauf)
export function verifySessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const [version, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isInteger(exp) || exp * 1000 <= now) return false;
  const expected = Buffer.from(sign(`${version}.${expStr}`, secret));
  const actual = Buffer.from(sig);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
