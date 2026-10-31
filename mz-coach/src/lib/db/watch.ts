// Datenbank: Watchlist des Transfermarkts (angenommene Vorschläge, Marcus 31.10.2026) und Jugend-Entscheidungen.

import type Database from "better-sqlite3";
import type { MarktSpieler } from "@/lib/mz/parser/transfer";

export type WatchBewertung = { rolle: string; statt: string; gewinn: number; neu: number; preis: number };
export type WatchEintrag = { pid: number; name: string; spieler: MarktSpieler; bewertung?: WatchBewertung; aufgenommen: string };

export function nimmAufWatchlist(db: Database.Database, s: MarktSpieler, bewertung?: WatchBewertung, zeit = new Date().toISOString()) {
  db.prepare(
    `INSERT INTO markt_watch (pid, name, spieler_json, bewertung_json, aufgenommen) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(pid) DO UPDATE SET name = excluded.name, spieler_json = excluded.spieler_json, bewertung_json = excluded.bewertung_json`,
  ).run(s.pid, s.name, JSON.stringify(s), bewertung ? JSON.stringify(bewertung) : null, zeit);
}

export function entferneVonWatchlist(db: Database.Database, pid: number) {
  db.prepare("DELETE FROM markt_watch WHERE pid = ?").run(pid);
}

export function ladeWatchlist(db: Database.Database): WatchEintrag[] {
  const rows = db.prepare("SELECT pid, name, spieler_json, bewertung_json, aufgenommen FROM markt_watch ORDER BY aufgenommen DESC").all() as {
    pid: number;
    name: string;
    spieler_json: string;
    bewertung_json: string | null;
    aufgenommen: string;
  }[];
  return rows.map((r) => ({
    pid: r.pid,
    name: r.name,
    spieler: JSON.parse(r.spieler_json) as MarktSpieler,
    bewertung: r.bewertung_json ? (JSON.parse(r.bewertung_json) as WatchBewertung) : undefined,
    aufgenommen: r.aufgenommen,
  }));
}

// Jugend: eigene Entscheidung behalten/abgeben (überschreibt die Einstufung nach Scoutbericht)
export type JugendEntscheidung = "behalten" | "abgeben";

export function setzeJugendEntscheidung(db: Database.Database, pid: number, e: JugendEntscheidung, zeit = new Date().toISOString()) {
  db.prepare(
    `INSERT INTO jugend_entscheidung (pid, entscheidung, geaendert) VALUES (?, ?, ?)
     ON CONFLICT(pid) DO UPDATE SET entscheidung = excluded.entscheidung, geaendert = excluded.geaendert`,
  ).run(pid, e, zeit);
}

export function ladeJugendEntscheidungen(db: Database.Database): Map<number, JugendEntscheidung> {
  const rows = db.prepare("SELECT pid, entscheidung FROM jugend_entscheidung").all() as { pid: number; entscheidung: JugendEntscheidung }[];
  return new Map(rows.map((r) => [r.pid, r.entscheidung]));
}
