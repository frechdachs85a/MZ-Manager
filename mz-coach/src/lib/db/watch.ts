// Datenbank: Watchlist des Transfermarkts (angenommene Vorschläge, Marcus 31.10.2026) und Jugend-Entscheidungen.

import type Database from "better-sqlite3";
import { endeAlsDatum, type MarktSpieler } from "@/lib/mz/parser/transfer";
import { berlinZuUtc } from "@/lib/mz/parser/kader";

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

// Auktionsende eines Spielers (Text "31-10-2026 20:37", Berliner Zeit) als Zeitpunkt
function endeMs(s: MarktSpieler): number | undefined {
  const m = endeAlsDatum(s.markt.ende)?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  return m ? berlinZuUtc(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : undefined;
}

// Watchlist aufräumen (Marcus, 31.10.2026: wer nicht mehr auf dem Markt ist, verschwindet). Steht der Spieler in der
// neuesten Marktsuche, wird die Momentaufnahme aktualisiert (Gebot, verlängertes Ende). Ist das zuletzt bekannte
// Auktionsende (Watchlist, Marktsuche oder Bietomat-Auftrag) mehr als NACHLAUF_MIN vorbei, wird er entfernt.
export const WATCH_NACHLAUF_MIN = 30;
export function watchlistAufraeumen(db: Database.Database, neueste: MarktSpieler[] = [], auftragEnde = new Map<number, string>(), jetzt = new Date()): string[] {
  const weg: string[] = [];
  const frisch = new Map(neueste.map((s) => [s.pid, s]));
  for (const w of ladeWatchlist(db)) {
    const neu = frisch.get(w.pid);
    if (neu) db.prepare("UPDATE markt_watch SET spieler_json = ? WHERE pid = ?").run(JSON.stringify(neu), w.pid);
    const s = neu ?? w.spieler;
    const kandidaten = [endeMs(s), auftragEnde.has(w.pid) ? Date.parse(auftragEnde.get(w.pid)!) : undefined].filter((x): x is number => x !== undefined && !Number.isNaN(x));
    if (!kandidaten.length) continue;
    if (Math.max(...kandidaten) + WATCH_NACHLAUF_MIN * 60_000 < jetzt.getTime()) {
      entferneVonWatchlist(db, w.pid);
      weg.push(w.name);
    }
  }
  return weg;
}
