// Datenbank: Taktik-Archiv (XML je Reiter).

import type Database from "better-sqlite3";

export type GespeicherteTaktik = { reiter: string; xml: string; gespeichert: string; quelle: string };

// Taktik-XML eines Reiters speichern
export function speichereTaktikXml(db: Database.Database, reiter: string, xml: string, quelle: string, zeit = new Date().toISOString()) {
  db.prepare(
    `INSERT INTO taktik (reiter, xml, gespeichert, quelle) VALUES (?, ?, ?, ?)
     ON CONFLICT(reiter) DO UPDATE SET xml = excluded.xml, gespeichert = excluded.gespeichert, quelle = excluded.quelle`,
  ).run(reiter, xml, zeit, quelle);
}

// Alle Taktiken im Archiv
export function ladeTaktiken(db: Database.Database): GespeicherteTaktik[] {
  return db.prepare("SELECT reiter, xml, gespeichert, quelle FROM taktik ORDER BY reiter").all() as GespeicherteTaktik[];
}

// Taktik eines Reiters löschen
export function loescheTaktik(db: Database.Database, reiter: string) {
  db.prepare("DELETE FROM taktik WHERE reiter = ?").run(reiter);
}
