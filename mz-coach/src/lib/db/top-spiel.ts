import type Database from "better-sqlite3";
import type { SpielMuster } from "@/lib/mz/analyse/muster";

export type TopArt = "liga" | "weltliga";

export function topSpielVorhanden(db: Database.Database, mid: number, tid: number): boolean {
  return !!db.prepare("SELECT 1 FROM top_spiel WHERE mid = ? AND tid = ?").get(mid, tid);
}

// Ein Muster je Spiel und Team, nie doppelt
export function speichereTopSpiel(db: Database.Database, tid: number, art: TopArt, m: SpielMuster, zeit = new Date().toISOString()) {
  db.prepare("INSERT OR IGNORE INTO top_spiel (mid, tid, datum, art, muster_json, gespeichert) VALUES (?, ?, ?, ?, ?, ?)").run(
    m.mid, tid, m.datum ?? null, art, JSON.stringify(m), zeit,
  );
}

// Die neuesten n Muster eines Teams je Art
export function ladeTopSpiele(db: Database.Database, tid: number, art: TopArt, n = 10): SpielMuster[] {
  const rows = db.prepare("SELECT muster_json FROM top_spiel WHERE tid = ? AND art = ? ORDER BY datum DESC, mid DESC LIMIT ?").all(tid, art, n) as { muster_json: string }[];
  return rows.map((r) => JSON.parse(r.muster_json) as SpielMuster);
}
