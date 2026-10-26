// Taktik-Archiv auswerten: Reiter laden, gespielte Spiele einem Reiter zuordnen.

import type Database from "better-sqlite3";
import { ladeKader } from "@/lib/db/kader";
import { ladeTaktiken } from "@/lib/db/taktik";
import { abweichung, GLEICH_TOLERANZ } from "@/lib/mz/analyse/gegner";
import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { pruefeTaktik, type Pruefung } from "@/lib/mz/taktik/pruefer";
import { parseTaktikXml, TaktikXmlFehler, type Taktik } from "@/lib/mz/taktik/xml";
import { TEAM } from "@/lib/wissen/startbasis";

export type ArchivEintrag = {
  reiter: string;
  gespeichert: string;
  quelle: string;
  taktik: Taktik | null;
  xmlFehler?: string;
  pruefung: Pruefung | null;
};

// Archiv mit Prüfung gegen den aktuellen Kader (Kegel, Verletzung, Sperre ändern sich täglich)
export function archivLaden(db: Database.Database): ArchivEintrag[] {
  const kader = ladeKader(db);
  return ladeTaktiken(db).map((t) => {
    try {
      const taktik = parseTaktikXml(t.xml);
      return { ...t, taktik, pruefung: pruefeTaktik(taktik, kader) };
    } catch (e) {
      return { ...t, taktik: null, pruefung: null, xmlFehler: e instanceof TaktikXmlFehler ? e.message : String(e) };
    }
  });
}

export type Zuordnung = { reiter: string; abweichung: number } | null;

// Welche Archiv-Taktik passt zur Startaufstellung eines eigenen Spiels? Feldspieler-Positionen (ohne Torwart)
// müssen bis auf GLEICH_TOLERANZ Punkte übereinstimmen und die Taktik-Einstellung gleich sein.
// Geprüft wird nur die Lage, nicht welche Spieler dort standen.
export function taktikZuordnen(spiel: StatsSpiel, archiv: ArchivEintrag[], tid = TEAM.tid): Zuordnung {
  const team = spiel.teams.find((t) => t.id === tid);
  if (!team) return null;
  const feld = spiel.spieler.filter((p) => p.teamId === tid && p.editor && !p.torwart).map((p) => p.editor!);
  let best: Zuordnung = null;
  for (const a of archiv) {
    if (!a.taktik) continue;
    const pos = a.taktik.pos.filter((p) => p.pos === "normal").map((p) => p.start);
    if (a.taktik.team.tactics && team.tactic && a.taktik.team.tactics !== team.tactic) continue;
    const d = abweichung(feld, pos);
    if (d <= GLEICH_TOLERANZ && (!best || d < best.abweichung)) best = { reiter: a.reiter, abweichung: d };
  }
  return best;
}

export type TaktikSpiel = { mid: number; datum?: string; gegner: string; eigen: number; gegnerTore: number; ballbesitz?: string; abweichung: number };

// Eigene gespeicherte Spiele je Archiv-Taktik (Zuordnung über die Startaufstellung)
export function spieleJeTaktik(db: Database.Database, archiv: ArchivEintrag[]): Map<string, TaktikSpiel[]> {
  const rows = db.prepare("SELECT auswertung_json FROM spiel WHERE auswertung_json IS NOT NULL").all() as { auswertung_json: string }[];
  const out = new Map<string, TaktikSpiel[]>();
  for (const r of rows) {
    const s = JSON.parse(r.auswertung_json) as StatsSpiel;
    const eigen = s.teams.find((t) => t.id === TEAM.tid);
    const gegner = s.teams.find((t) => t.id !== TEAM.tid);
    if (!eigen || !gegner) continue;
    const z = taktikZuordnen(s, archiv);
    if (!z) continue;
    const liste = out.get(z.reiter) ?? [];
    liste.push({
      mid: s.mid,
      datum: s.datum,
      gegner: gegner.name,
      eigen: Number(eigen.statistik.goals ?? NaN),
      gegnerTore: Number(gegner.statistik.goals ?? NaN),
      ballbesitz: eigen.statistik.possession,
      abweichung: z.abweichung,
    });
    out.set(z.reiter, liste.sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? "")));
  }
  return out;
}
