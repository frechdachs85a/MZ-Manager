import type Database from "better-sqlite3";
import { ladeTeamSpiele, listeEchteGegner, teamName } from "@/lib/db/gegner";
import { ladeTopTeams } from "@/lib/db/top";
import { ladeSpiel } from "@/lib/db/spiele";
import { analysiereGegner, type GegnerAnalyse } from "@/lib/mz/analyse/gegner";
import { LIGA_MID_AB, letzteLigaspiele } from "@/lib/mz/parser/spielliste";
import type { StatsSpiel } from "@/lib/mz/parser/stats";

// Analyse eines Gegners aus seinen letzten 8 gespeicherten Ligaspielen (gemeinsam für Gegner- und Übersichtsseite)
export function gegnerAnalyseLaden(db: Database.Database, tid: number) {
  const spiele = ladeTeamSpiele(db, tid);
  const liga = letzteLigaspiele(spiele);
  const stats = liga
    .filter((s) => s.xml)
    .map((s) => ladeSpiel(db, s.mid))
    .filter((s): s is StatsSpiel & { abgerufen: string } => !!s);
  const analyse: GegnerAnalyse | null = stats.length ? analysiereGegner(tid, stats) : null;
  return { tid, name: teamName(db, tid) ?? `tid ${tid}`, spiele, liga, stats, analyse };
}

// Zuletzt eingelesener Gegner (ob er wirklich der nächste ist, weiß die Seite erst mit dem Spielplan-Abruf)
export function letzterGegner(db: Database.Database) {
  const g = listeEchteGegner(db, LIGA_MID_AB, new Set(ladeTopTeams(db).map((t) => t.tid)))[0];
  return g ? { ...gegnerAnalyseLaden(db, g.tid), stand: g.stand } : null;
}
