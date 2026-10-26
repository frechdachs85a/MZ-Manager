import type Database from "better-sqlite3";
import type { StatsSpiel } from "@/lib/mz/parser/stats";

// Jedes Spiel einmal: Roh-XML plus Auswertung (Auftrag, Funktion 7). Nie doppelt speichern.

export function spielVorhanden(db: Database.Database, mid: number): boolean {
  return !!db.prepare("SELECT 1 FROM spiel WHERE mid = ? AND stats_xml IS NOT NULL").get(mid);
}

// Spiel (Stats-XML) speichern
export function speichereSpiel(db: Database.Database, s: StatsSpiel, xml: string, zeit = new Date().toISOString()): "neu" | "vorhanden" {
  if (spielVorhanden(db, s.mid)) return "vorhanden";
  db.prepare(
    `INSERT INTO spiel (mid, typ, abgerufen, stats_xml, auswertung_json) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(mid) DO UPDATE SET typ = excluded.typ, abgerufen = excluded.abgerufen,
       stats_xml = excluded.stats_xml, auswertung_json = excluded.auswertung_json`,
  ).run(s.mid, s.typ ?? null, zeit, xml, JSON.stringify(s));
  return "neu";
}

// Gespeichertes Spiel
export function ladeSpiel(db: Database.Database, mid: number): (StatsSpiel & { abgerufen: string }) | null {
  const row = db.prepare("SELECT auswertung_json, abgerufen FROM spiel WHERE mid = ?").get(mid) as
    | { auswertung_json: string | null; abgerufen: string }
    | undefined;
  return row?.auswertung_json ? { ...JSON.parse(row.auswertung_json), abgerufen: row.abgerufen } : null;
}

export type SpielZeile = { mid: number; datum?: string; heim: string; gast: string; tore: string; final: boolean };

// Gespeicherte Spiele, neueste zuerst
export function listeSpiele(db: Database.Database, limit = 100): SpielZeile[] {
  const rows = db.prepare("SELECT auswertung_json FROM spiel WHERE auswertung_json IS NOT NULL").all() as {
    auswertung_json: string;
  }[];
  return rows
    .map((r) => JSON.parse(r.auswertung_json) as StatsSpiel)
    .map((s) => {
      const heim = s.teams.find((t) => t.heim) ?? s.teams[0];
      const gast = s.teams.find((t) => t !== heim)!;
      return { mid: s.mid, datum: s.datum, heim: heim.name, gast: gast.name, tore: `${heim.statistik.goals ?? "?"}:${gast.statistik.goals ?? "?"}`, final: s.final };
    })
    .sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""))
    .slice(0, limit);
}
