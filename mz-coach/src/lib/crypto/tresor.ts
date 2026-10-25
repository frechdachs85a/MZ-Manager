import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { tresorKeyAusDatei } from "@/lib/auth/geheimnisse";

// AES-256-GCM für ManagerZone-Zugangsdaten und Session-Cookie.
// Schlüssel aus der Umgebungsvariable MZ_TRESOR_KEY (32 Byte, base64), sonst aus geheimnisse.json auf dem
// Laufwerk (beim ersten Start erzeugt, ändert sich danach nie).
// Format: v1.<iv>.<tag>.<daten> (base64url)

export function tresorSchluessel(): Buffer {
  const raw = process.env.MZ_TRESOR_KEY || tresorKeyAusDatei();
  const key = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (key.length !== 32) throw new Error("MZ_TRESOR_KEY fehlt oder ist nicht 32 Byte (base64)");
  return key;
}

export function verschluesseln(klartext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const daten = Buffer.concat([c.update(klartext, "utf8"), c.final()]);
  return ["v1", iv, c.getAuthTag(), daten].map((t) => (typeof t === "string" ? t : t.toString("base64url"))).join(".");
}

export function entschluesseln(geheim: string, key: Buffer): string {
  const [v, iv, tag, daten] = geheim.split(".");
  if (v !== "v1" || !iv || !tag || daten === undefined) throw new Error("Unbekanntes Tresor-Format");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(daten, "base64url")), d.final()]).toString("utf8");
}
