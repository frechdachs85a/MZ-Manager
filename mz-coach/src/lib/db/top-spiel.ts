import type Database from "better-sqlite3";
import { engeMitteAus, formation } from "@/lib/mz/analyse/gegner";
import type { SpielMuster, Stil } from "@/lib/mz/analyse/muster";

// Formation, Fünferkette und enge Mitte aus den gespeicherten Positionen neu bestimmen, damit eine geänderte
// Zonengrenze (Abwehr ab y 215 seit 26.10.2026, vorher 222) auch für schon gespeicherte Muster gilt
function neuBestimmt<T extends Stil>(s: T): T {
  if (!s.feld?.length) return s;
  const f = formation(s.feld);
  return { ...s, formation: f, fuenferkette: f.abwehr >= 5, engeMitte: engeMitteAus(s.feld).engeMitte };
}

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
  return rows.map((r) => {
    const m = JSON.parse(r.muster_json) as SpielMuster;
    return { ...m, eigen: neuBestimmt(m.eigen), gegner: neuBestimmt(m.gegner) };
  });
}
