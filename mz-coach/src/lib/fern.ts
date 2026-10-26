import { createHash, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";

// Fernzugang für Claude, von Marcus am 26.10.2026 ausdrücklich erlaubt („ich erlaube es dir ausdrücklich und nehme
// das Risiko an“). Claudes Umgebung erreicht die Domain, aber weder den Server per SSH noch den Browser von Marcus.
// Mit dem Schlüssel darf Claude nur: die Diagnose lesen (ohne Zugangsdaten, Cookies, Schlüssel) und einen Abruf
// starten (gebremst). Kein Zugriff auf App-Passwort, MZ-Zugang oder Einstellungen.
// Im öffentlichen Repo steht nur der SHA-256-Hash des Schlüssels.
// Abschalten: Umgebungsvariable FERN_AUS=1 (in deploy/server/.env) oder automatisch nach FERN_BIS.
export const FERN_HASH = "0e1f38a689c7b975842d1c49ea20f358b6cd771c79e23b27658de4b33b4e6fb2";
export const FERN_BIS = "2026-11-30T23:59:59Z";
export const ABRUF_PAUSE_MIN = 15; // je Abrufart höchstens alle 15 Minuten (Schutz vor IP-Sperre bei ManagerZone)

// Fernschlüssel prüfen
export function fernErlaubt(authorization: string | null, jetzt = new Date()): boolean {
  if (process.env.FERN_AUS) return false;
  if (jetzt > new Date(FERN_BIS)) return false;
  const token = authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return false;
  const ist = createHash("sha256").update(token).digest();
  return timingSafeEqual(ist, Buffer.from(FERN_HASH, "hex"));
}

// Bremse je Abrufart, Zeitpunkt in der Datenbank (übersteht Neustarts)
export function fernAbrufFrei(db: Database.Database, art: string, jetzt = new Date()): { frei: boolean; ab?: string } {
  const key = `fern_abruf_${art}`;
  const r = db.prepare("SELECT wert FROM einstellung WHERE schluessel = ?").get(key) as { wert: string } | undefined;
  const ab = r ? new Date(new Date(r.wert).getTime() + ABRUF_PAUSE_MIN * 60_000) : null;
  if (ab && ab > jetzt) return { frei: false, ab: ab.toISOString() };
  db.prepare(
    "INSERT INTO einstellung (schluessel, wert, geaendert) VALUES (?, ?, ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert = excluded.geaendert",
  ).run(key, jetzt.toISOString(), jetzt.toISOString());
  return { frei: true };
}
