// Datenbank: Scoutspiele gegen kommende Gegner (Stats-XML ausgewertet).

import type Database from "better-sqlite3";
import type { StatsSpiel } from "@/lib/mz/parser/stats";

export function speichereScoutSpiel(db: Database.Database, s: { mid: number; gegnerTid: number; gegnerName?: string; datum?: string; spiel: StatsSpiel }, zeit = new Date().toISOString()) {
  db.prepare(
    `INSERT INTO scout_spiel (mid, gegner_tid, gegner_name, datum, auswertung_json, abgerufen) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(mid) DO UPDATE SET auswertung_json = excluded.auswertung_json, abgerufen = excluded.abgerufen`,
  ).run(s.mid, s.gegnerTid, s.gegnerName ?? null, s.datum ?? null, JSON.stringify(s.spiel), zeit);
}

export function ladeScoutSpiele(db: Database.Database, gegnerTid: number): { mid: number; gegnerName: string | null; datum: string | null; spiel: StatsSpiel }[] {
  const rows = db.prepare("SELECT mid, gegner_name, datum, auswertung_json FROM scout_spiel WHERE gegner_tid = ? ORDER BY mid").all(gegnerTid) as {
    mid: number;
    gegner_name: string | null;
    datum: string | null;
    auswertung_json: string;
  }[];
  return rows.map((r) => ({ mid: r.mid, gegnerName: r.gegner_name, datum: r.datum, spiel: JSON.parse(r.auswertung_json) as StatsSpiel }));
}

export const bekannteScoutMids = (db: Database.Database) => new Set((db.prepare("SELECT mid FROM scout_spiel").all() as { mid: number }[]).map((r) => r.mid));
