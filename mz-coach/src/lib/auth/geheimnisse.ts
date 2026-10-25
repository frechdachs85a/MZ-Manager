import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Geheimnisse der App ohne Handarbeit beim Hoster (Ersteinrichtung, 25.10.2026):
// SESSION_SECRET und MZ_TRESOR_KEY werden beim ersten Start zufällig erzeugt und neben der Datenbank auf dem
// dauerhaften Laufwerk gespeichert (geheimnisse.json, nur für den Server lesbar). Das App-Passwort legt Marcus
// auf /einrichtung selbst fest; dafür braucht es den Einrichtungscode aus dem Serverprotokoll.
// Umgebungsvariablen haben weiter Vorrang (wer sie gesetzt hat, muss nichts ändern).
// Achtung: Der Tresor-Schlüssel darf sich nie ändern, sonst ist der gespeicherte MZ-Zugang nicht mehr lesbar.

export type Geheimnisse = { sessionSecret: string; tresorKey: string; passwortHash?: string; einrichtungscode?: string };

export function geheimnisPfad(): string {
  return join(dirname(process.env.DATABASE_PATH ?? "./data/mz-coach.db"), "geheimnisse.json");
}

function lies(pfad: string): Geheimnisse | null {
  try {
    return JSON.parse(readFileSync(pfad, "utf8")) as Geheimnisse;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

// Atomar schreiben (erst Hilfsdatei, dann umbenennen), Rechte 600
function schreibe(pfad: string, g: Geheimnisse) {
  mkdirSync(dirname(pfad), { recursive: true });
  const tmp = `${pfad}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(g, null, 2), { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, pfad);
}

const neu = (): Geheimnisse => ({ sessionSecret: randomBytes(48).toString("base64url"), tresorKey: randomBytes(32).toString("base64") });

// Lädt die Datei oder legt sie beim ersten Aufruf an. Gibt es sie schon, wird nie etwas neu erzeugt.
export function ladeGeheimnisse(pfad = geheimnisPfad()): Geheimnisse {
  const g = lies(pfad);
  if (g) return g;
  try {
    mkdirSync(dirname(pfad), { recursive: true });
    // wx: nur anlegen, wenn noch nicht vorhanden (zwei Prozesse gleichzeitig: einer gewinnt)
    writeFileSync(pfad, JSON.stringify(neu(), null, 2), { mode: 0o600, flag: "wx" });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  return lies(pfad)!;
}

export function sessionSecretAusDatei(pfad?: string): string {
  return ladeGeheimnisse(pfad).sessionSecret;
}

export function tresorKeyAusDatei(pfad?: string): string {
  return ladeGeheimnisse(pfad).tresorKey;
}

// Passwort-Hash: Umgebungsvariable vor Datei. undefined = noch nicht eingerichtet.
export function passwortHash(pfad?: string): string | undefined {
  return process.env.APP_PASSWORD_HASH || ladeGeheimnisse(pfad).passwortHash || undefined;
}

export function istEingerichtet(pfad?: string): boolean {
  return !!passwortHash(pfad);
}

// Einrichtungscode für /einrichtung: nur solange kein Passwort gesetzt ist, bleibt bis zur Einrichtung gleich
// Selbst gewählter Code über die Umgebungsvariable EINRICHTUNGSCODE (mind. 8 Zeichen), z. B. beim Erstellen des
// Servers in der Cloud-Config gesetzt: dann muss niemand das Protokoll lesen.
export function einrichtungscode(pfad = geheimnisPfad()): string | undefined {
  if (istEingerichtet(pfad)) return undefined;
  const eigener = process.env.EINRICHTUNGSCODE?.trim().toUpperCase();
  if (eigener && eigener.length >= 8) return eigener;
  const g = ladeGeheimnisse(pfad);
  if (g.einrichtungscode) return g.einrichtungscode;
  const code = randomBytes(6).toString("hex").toUpperCase().replace(/(.{4})(?=.)/g, "$1-");
  schreibe(pfad, { ...g, einrichtungscode: code });
  return code;
}

export function speicherePasswortHash(hash: string, pfad = geheimnisPfad()) {
  const g: Geheimnisse = { ...ladeGeheimnisse(pfad), passwortHash: hash };
  delete g.einrichtungscode;
  schreibe(pfad, g);
}
