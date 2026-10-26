import "server-only";
import type Database from "better-sqlite3";
import { entschluesseln, tresorSchluessel, verschluesseln } from "@/lib/crypto/tresor";

// ManagerZone-Zugang, verschlüsselt in der Datenbank. Niemals loggen, nie an den Browser geben.
const KEY = "mz_zugang";

type Zugang = { benutzer: string; passwort: string };

// Zugang verschlüsselt speichern
export function speichereZugang(db: Database.Database, z: Zugang) {
  const wert = verschluesseln(JSON.stringify(z), tresorSchluessel());
  db.prepare(
    `INSERT INTO einstellung (schluessel, wert, geaendert) VALUES (?, ?, ?)
     ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert = excluded.geaendert`,
  ).run(KEY, wert, new Date().toISOString());
  vergissSitzung(db);
}

// Neuer oder gelöschter Zugang: alte Sitzungs-Cookies und gemerkte Login-Fehler verwerfen.
function vergissSitzung(db: Database.Database) {
  db.prepare("DELETE FROM einstellung WHERE schluessel IN ('mz_cookies', 'mz_login_fehler')").run();
}

// Zugang entschlüsseln
export function ladeZugang(db: Database.Database): Zugang | null {
  const row = db.prepare("SELECT wert FROM einstellung WHERE schluessel = ?").get(KEY) as
    | { wert: string }
    | undefined;
  return row ? JSON.parse(entschluesseln(row.wert, tresorSchluessel())) : null;
}

// Für die Oberfläche: nur ob und seit wann, nie der Inhalt.
export function zugangStatus(db: Database.Database): { eingerichtet: boolean; geaendert?: string } {
  const row = db.prepare("SELECT geaendert FROM einstellung WHERE schluessel = ?").get(KEY) as
    | { geaendert: string }
    | undefined;
  return row ? { eingerichtet: true, geaendert: row.geaendert } : { eingerichtet: false };
}

// Zugang löschen
export function loescheZugang(db: Database.Database) {
  db.prepare("DELETE FROM einstellung WHERE schluessel = ?").run(KEY);
  vergissSitzung(db);
}
