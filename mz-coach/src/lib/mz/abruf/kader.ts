import "server-only";
import type Database from "better-sqlite3";
import { abrufBeenden, abrufBeginnen, speichereRohseite } from "@/lib/db/abruf";
import { mitMzSitzung, MzFehler } from "./sitzung";

// Eigene Spielerseite, eingeloggt (mz-wissen.md, Abschnitt 2 "Eigene Spieler").
export const KADER_PFAD = "/?p=players";

export type KaderAbrufErgebnis = { ok: true; rohseiteId: number; bytes: number } | { ok: false; meldung: string };

// Ruft die eigene Kaderseite ab und speichert sie unverändert. Das Auslesen der Spieler
// folgt, sobald der Aufbau der eingeloggten Seite an echtem HTML geprüft ist.
export async function kaderAbrufen(db: Database.Database, opt = { manuell: false }): Promise<KaderAbrufErgebnis> {
  const log = abrufBeginnen(db, "kader");
  try {
    const seite = await mitMzSitzung(db, (s) => s.holeSeite(KADER_PFAD), opt);
    const id = speichereRohseite(db, { art: "kader", ...seite });
    const bytes = (seite.htmlDom ?? seite.htmlRoh ?? "").length;
    abrufBeenden(db, log, true, `Kaderseite gespeichert (${bytes} Zeichen, HTTP ${seite.status ?? "?"}).`);
    return { ok: true, rohseiteId: id, bytes };
  } catch (e) {
    // Login-Fehler sind bereits als MzFehler ohne Eingaben formuliert. Sonstige Fehler
    // (Browser fehlt, Zeitüberschreitung) enthalten nur URLs, erste Zeile reicht.
    const meldung =
      e instanceof MzFehler
        ? e.message
        : `Technischer Fehler: ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`;
    abrufBeenden(db, log, false, meldung);
    return { ok: false, meldung };
  }
}
