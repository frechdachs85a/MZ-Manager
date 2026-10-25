import type Database from "better-sqlite3";

export type GespeicherteTaktik = { reiter: string; xml: string; gespeichert: string; quelle: string };

export function speichereTaktikXml(db: Database.Database, reiter: string, xml: string, quelle: string, zeit = new Date().toISOString()) {
  db.prepare(
    `INSERT INTO taktik (reiter, xml, gespeichert, quelle) VALUES (?, ?, ?, ?)
     ON CONFLICT(reiter) DO UPDATE SET xml = excluded.xml, gespeichert = excluded.gespeichert, quelle = excluded.quelle`,
  ).run(reiter, xml, zeit, quelle);
}

export function ladeTaktiken(db: Database.Database): GespeicherteTaktik[] {
  return db.prepare("SELECT reiter, xml, gespeichert, quelle FROM taktik ORDER BY reiter").all() as GespeicherteTaktik[];
}

export function ladeTaktik(db: Database.Database, reiter: string): GespeicherteTaktik | null {
  return (db.prepare("SELECT reiter, xml, gespeichert, quelle FROM taktik WHERE reiter = ?").get(reiter) as GespeicherteTaktik | undefined) ?? null;
}

export function loescheTaktik(db: Database.Database, reiter: string) {
  db.prepare("DELETE FROM taktik WHERE reiter = ?").run(reiter);
}
