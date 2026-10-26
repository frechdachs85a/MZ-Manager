// Datenbank: Liste der Topteams.

import type Database from "better-sqlite3";
import { QUELLE_TOP10, TOP10 } from "@/lib/wissen/startbasis";

export type TopTeam = { tid: number; rang: number; name: string; quelle: string; stand: string };

// Gespeicherte Topteams; ohne Eintrag die Startliste aus mz-wissen.md
export function ladeTopTeams(db: Database.Database): TopTeam[] {
  const rows = db.prepare("SELECT tid, rang, name, quelle, stand FROM top_team ORDER BY rang").all() as TopTeam[];
  return rows.length ? rows : TOP10.map((t) => ({ ...t, quelle: QUELLE_TOP10, stand: "2026-10-21" }));
}

