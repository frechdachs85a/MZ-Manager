import type Database from "better-sqlite3";

// Jede Migration genau einmal, in dieser Reihenfolge. Nie bestehende ändern, nur anhängen.
const MIGRATIONEN: string[] = [
  `
  CREATE TABLE einstellung (
    schluessel TEXT PRIMARY KEY,
    wert TEXT NOT NULL,
    geaendert TEXT NOT NULL
  );

  -- aktueller Stand je eigenem Spieler
  CREATE TABLE spieler (
    pid INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    nr INTEGER,
    alter_jahre INTEGER,
    daten_json TEXT NOT NULL,      -- Skills, Status, Marktwert, Scout usw.
    quelle TEXT NOT NULL,          -- woher der Stand stammt (URL/Seite)
    abgerufen TEXT NOT NULL,       -- ISO-Zeit
    aktiv INTEGER NOT NULL DEFAULT 1
  );

  -- jeder Abruf als unveränderlicher Schnappschuss
  CREATE TABLE spieler_snapshot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pid INTEGER NOT NULL,
    abgerufen TEXT NOT NULL,
    quelle TEXT NOT NULL,
    daten_json TEXT NOT NULL
  );
  CREATE INDEX spieler_snapshot_pid ON spieler_snapshot(pid, abgerufen);

  -- erkannte Änderungen (neuer Ball, Verlust, Form, Marktwert ...)
  CREATE TABLE spieler_aenderung (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pid INTEGER NOT NULL,
    datum TEXT NOT NULL,
    feld TEXT NOT NULL,
    alt TEXT,
    neu TEXT,
    quelle TEXT NOT NULL
  );
  CREATE INDEX spieler_aenderung_datum ON spieler_aenderung(datum);

  -- jedes abgerufene Spiel, Roh-XML plus Auswertung. Nie doppelt abrufen.
  CREATE TABLE spiel (
    mid INTEGER PRIMARY KEY,
    typ TEXT,
    abgerufen TEXT NOT NULL,
    stats_xml TEXT,
    auswertung_json TEXT
  );
  `,
];

export function migrieren(db: Database.Database) {
  const version = db.pragma("user_version", { simple: true }) as number;
  for (let i = version; i < MIGRATIONEN.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONEN[i]);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}
