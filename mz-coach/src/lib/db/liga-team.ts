// Datenbank: Startelf je Ligateam aus seinem letzten Ligaspiel und Weltrang (Marcus, 31.10.2026: in der Ligatabelle
// den Teamwert der letzten Startelf und die Weltrangplatzierung zeigen und danach sortieren).

import type Database from "better-sqlite3";

export type LigaElf = { tid: number; mid: number; datum?: string; elf: number[]; abgerufen: string };

// Startelf eines Teams ersetzen
export function speichereLigaElf(db: Database.Database, e: Omit<LigaElf, "abgerufen">, zeit = new Date().toISOString()) {
  db.prepare(
    "INSERT INTO liga_elf (tid, mid, datum, elf_json, abgerufen) VALUES (?, ?, ?, ?, ?) ON CONFLICT(tid) DO UPDATE SET mid = excluded.mid, datum = excluded.datum, elf_json = excluded.elf_json, abgerufen = excluded.abgerufen",
  ).run(e.tid, e.mid, e.datum ?? null, JSON.stringify(e.elf), zeit);
}

// Alle gespeicherten Startelfen, je tid
export function ladeLigaElfen(db: Database.Database): Map<number, LigaElf> {
  const rows = db.prepare("SELECT tid, mid, datum, elf_json, abgerufen FROM liga_elf").all() as {
    tid: number;
    mid: number;
    datum: string | null;
    elf_json: string;
    abgerufen: string;
  }[];
  return new Map(rows.map((r) => [r.tid, { tid: r.tid, mid: r.mid, datum: r.datum ?? undefined, elf: JSON.parse(r.elf_json) as number[], abgerufen: r.abgerufen }]));
}

// Weltrang eines Teams speichern (null = auf der Seite nicht gefunden)
export function speichereLigaRang(db: Database.Database, tid: number, rang: number | null, zeit = new Date().toISOString()) {
  db.prepare("INSERT INTO liga_rang (tid, rang, stand) VALUES (?, ?, ?) ON CONFLICT(tid) DO UPDATE SET rang = excluded.rang, stand = excluded.stand").run(
    tid,
    rang,
    zeit,
  );
}

// Alle gespeicherten Weltränge, je tid
export function ladeLigaRaenge(db: Database.Database): Map<number, { rang: number | null; stand: string }> {
  const rows = db.prepare("SELECT tid, rang, stand FROM liga_rang").all() as { tid: number; rang: number | null; stand: string }[];
  return new Map(rows.map((r) => [r.tid, { rang: r.rang, stand: r.stand }]));
}
