// Archiv und Wartung: Top-10-Auswertung archivieren, alte Daten aufräumen, Datenbank sichern.

import type Database from "better-sqlite3";
import { existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { topAuswertung } from "@/lib/top-auswertung";

const berlinTag = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);

// Top-10-Auswertung mit Datum festhalten (eine Zeile je Tag). Nur wenn sie sich gegenüber dem letzten
// Archiv-Eintrag geändert hat: keine doppelten Stände.
export function archiviereTop(db: Database.Database, jetzt = new Date()): boolean {
  const a = topAuswertung(db);
  const json = JSON.stringify(a);
  const letzter = db.prepare("SELECT auswertung_json FROM top_archiv WHERE datum < ? ORDER BY datum DESC LIMIT 1").get(berlinTag(jetzt)) as { auswertung_json: string } | undefined;
  if (letzter?.auswertung_json === json) return false;
  db.prepare(
    "INSERT INTO top_archiv (datum, spiele, auswertung_json) VALUES (?, ?, ?) ON CONFLICT(datum) DO UPDATE SET spiele = excluded.spiele, auswertung_json = excluded.auswertung_json",
  ).run(berlinTag(jetzt), a.spiele, json);
  return true;
}

// Archivierte Top-10-Auswertungen (Datum, Anzahl Spiele)
export function ladeTopArchiv(db: Database.Database): { datum: string; spiele: number }[] {
  return db.prepare("SELECT datum, spiele FROM top_archiv ORDER BY datum DESC").all() as { datum: string; spiele: number }[];
}

// Aufräumen gegen Datenmüll. Spiele, Spiellisten, Kaderverlauf (Änderungen), Taktiken und Archiv bleiben
// immer erhalten; gekürzt wird nur, was sich ohnehin bei jedem Abruf wiederholt.
export const BEHALTEN = { rohseitenJeArt: 3, marktSuchen: 7, abrufLog: 2000 };

// Alte Rohseiten, Marktsuchen und Protokolle kürzen
export function aufraeumen(db: Database.Database): string {
  let roh = 0;
  let suchen = 0;
  let snaps = 0;
  let log = 0;
  db.transaction(() => {
    // Rohseiten: je Art nur die neuesten
    roh = db
      .prepare(
        `DELETE FROM rohseite WHERE id IN (
           SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY art ORDER BY abgerufen DESC, id DESC) AS n FROM rohseite) WHERE n > ?)`,
      )
      .run(BEHALTEN.rohseitenJeArt).changes;
    // Marktsuchen: nur die letzten (die Empfehlung nutzt immer die neueste)
    const alte = db.prepare("SELECT id FROM markt_suche ORDER BY id DESC LIMIT -1 OFFSET ?").all(BEHALTEN.marktSuchen) as { id: number }[];
    for (const { id } of alte) {
      db.prepare("DELETE FROM markt_spieler WHERE suche_id = ?").run(id);
      suchen += db.prepare("DELETE FROM markt_suche WHERE id = ?").run(id).changes;
    }
    // Spieler-Schnappschüsse: identische Folge-Schnappschüsse desselben Spielers entfernen
    snaps = db
      .prepare(
        `DELETE FROM spieler_snapshot WHERE id IN (
           SELECT id FROM (SELECT id, daten_json, lag(daten_json) OVER (PARTITION BY pid ORDER BY abgerufen, id) AS vorher FROM spieler_snapshot)
           WHERE vorher = daten_json)`,
      )
      .run().changes;
    log = db
      .prepare("DELETE FROM abruf_log WHERE id IN (SELECT id FROM abruf_log ORDER BY id DESC LIMIT -1 OFFSET ?)")
      .run(BEHALTEN.abrufLog).changes;
  })();
  db.pragma("optimize");
  return `Aufgeräumt: ${roh} alte Rohseiten, ${suchen} alte Marktsuchen, ${snaps} doppelte Schnappschüsse, ${log} alte Protokollzeilen.`;
}

// Wöchentliche Sicherung der ganzen Datenbank neben die Datenbankdatei (Ordner sicherung), die letzten 8 bleiben
export const SICHERUNGEN = 8;
// Datenbank sichern, nur die letzten SICHERUNGEN behalten
export async function sichereDatenbank(db: Database.Database, pfad: string, jetzt = new Date()): Promise<string> {
  const ordner = join(dirname(pfad), "sicherung");
  if (!existsSync(ordner)) mkdirSync(ordner, { recursive: true });
  const ziel = join(ordner, `mz-coach-${berlinTag(jetzt)}.db`);
  await db.backup(ziel);
  const alle = readdirSync(ordner).filter((f) => /^mz-coach-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
  for (const f of alle.slice(0, Math.max(0, alle.length - SICHERUNGEN))) unlinkSync(join(ordner, f));
  return `Sicherung ${ziel} erstellt (${Math.min(alle.length, SICHERUNGEN)} vorhanden).`;
}
