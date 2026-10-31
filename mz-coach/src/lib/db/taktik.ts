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

// Reiter, wie sie zuletzt im Editor standen (Kaderabruf, Taktikseite): Buchstabe, Name, Altersregler, Spielerzahl.
// alterVon/alterBis aus Tactic["@attributes"].age_from/age_to (tactics.js, gelesen 31.10.2026); fehlen sie, gilt 16 bis 38.
export type EditorReiter = { slot: string; name: string; alterVon: number; alterBis: number; spieler: number };
export const ALTER_FREI = { von: 16, bis: 38 }; // Grenzen des Alter-Reglers im Editor (min 16, max 38)
export const istAltersreiter = (r: Pick<EditorReiter, "alterVon" | "alterBis">) => r.alterVon > ALTER_FREI.von || r.alterBis < ALTER_FREI.bis;

const EDITOR_KEY = "editor_reiter";

export function speichereEditorReiter(db: Database.Database, reiter: EditorReiter[], zeit = new Date().toISOString()) {
  db.prepare(
    `INSERT INTO einstellung (schluessel, wert, geaendert) VALUES (?, ?, ?)
     ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert = excluded.geaendert`,
  ).run(EDITOR_KEY, JSON.stringify(reiter), zeit);
}

export function ladeEditorReiter(db: Database.Database): { reiter: EditorReiter[]; stand: string } | null {
  const r = db.prepare("SELECT wert, geaendert FROM einstellung WHERE schluessel = ?").get(EDITOR_KEY) as { wert: string; geaendert: string } | undefined;
  return r ? { reiter: JSON.parse(r.wert) as EditorReiter[], stand: r.geaendert } : null;
}
