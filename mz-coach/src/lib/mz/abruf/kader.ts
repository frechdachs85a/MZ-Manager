import "server-only";
import type Database from "better-sqlite3";
import { abrufBeenden, abrufBeginnen, speichereRohseite } from "@/lib/db/abruf";
import { speichereKader } from "@/lib/db/kader";
import { KaderSeiteUnbekannt, parseKaderSeite } from "@/lib/mz/parser/kader";
import { mitMzSitzung, MZ_BASIS, MzFehler } from "./sitzung";

// Eigene Kaderübersicht als Tabelle, eingeloggt (Aufbau geprüft am 24.10.2026, docs/mz-seiten.md).
export const KADER_PFAD = "/?p=players&sub=alt";

export type KaderErgebnis =
  | { ok: true; spieler: number; neu: number; aenderungen: number; stand: string }
  | { ok: false; meldung: string };

// Wertet eine Kaderseite aus und speichert Rohseite, Schnappschüsse und Änderungen.
// Stand ist die Serverzeit der Seite, sonst der Zeitpunkt des Speicherns.
function speichereKaderSeite(
  db: Database.Database,
  html: string,
  seite: { url: string; status: number | null; htmlRoh: string | null; htmlDom: string | null },
  quelle: string,
): Extract<KaderErgebnis, { ok: true }> {
  const { spieler, serverzeit } = parseKaderSeite(html);
  const stand = serverzeit ?? new Date().toISOString();
  // Ältere Seiten nicht über einen neueren Stand legen, sonst entstünden rückwärts gerichtete Änderungen.
  const neuester = (db.prepare("SELECT max(abgerufen) AS z FROM spieler").get() as { z: string | null }).z;
  if (serverzeit && neuester === stand) {
    throw new MzFehler(`Diese Seite ist schon eingelesen (Stand ${stand.slice(0, 16).replace("T", " ")} UTC).`);
  }
  if (neuester && stand < neuester) {
    throw new MzFehler(`Die Seite ist vom ${stand.slice(0, 16).replace("T", " ")} UTC und damit älter als der gespeicherte Stand.`);
  }
  speichereRohseite(db, { art: "kader", ...seite }, stand);
  const r = speichereKader(db, spieler, quelle, stand);
  return { ok: true, spieler: spieler.length, ...r, stand };
}

function meldungAus(e: unknown): string {
  if (e instanceof MzFehler || e instanceof KaderSeiteUnbekannt) return e.message;
  // Sonstige Fehler (Browser fehlt, Zeitüberschreitung) enthalten nur URLs, erste Zeile reicht.
  return `Technischer Fehler: ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`;
}

export async function kaderAbrufen(db: Database.Database, opt = { manuell: false }): Promise<KaderErgebnis> {
  const log = abrufBeginnen(db, "kader");
  try {
    const seite = await mitMzSitzung(db, (s) => s.holeSeite(KADER_PFAD), opt);
    const r = speichereKaderSeite(db, seite.htmlDom ?? seite.htmlRoh ?? "", seite, `${MZ_BASIS}${KADER_PFAD}`);
    abrufBeenden(db, log, true, `${r.spieler} Spieler gelesen, ${r.neu} neu, ${r.aenderungen} Änderungen.`);
    return r;
  } catch (e) {
    const meldung = meldungAus(e);
    abrufBeenden(db, log, false, meldung);
    return { ok: false, meldung };
  }
}

// Von Hand im Browser gespeicherte Seite (Strg+S auf ?p=players&sub=alt), ohne automatischen Abruf.
export function kaderAusDatei(db: Database.Database, html: string, dateiname: string): KaderErgebnis {
  const log = abrufBeginnen(db, "kader");
  try {
    const r = speichereKaderSeite(
      db,
      html,
      { url: `Datei: ${dateiname}`, status: null, htmlRoh: html, htmlDom: null },
      `${MZ_BASIS}${KADER_PFAD} (von Hand gespeichert, Datei ${dateiname})`,
    );
    abrufBeenden(db, log, true, `Datei ${dateiname}: ${r.spieler} Spieler gelesen, ${r.neu} neu, ${r.aenderungen} Änderungen.`);
    return r;
  } catch (e) {
    const meldung = meldungAus(e);
    abrufBeenden(db, log, false, meldung);
    return { ok: false, meldung };
  }
}
