import type Database from "better-sqlite3";
import { ladeScoutSpiele } from "@/lib/db/scout-spiel";
import { archivLaden, taktikZuordnen } from "@/lib/taktik-archiv";
import { TEAM } from "@/lib/wissen/startbasis";
import type { ScoutBericht, ScoutTaktik } from "@/lib/wissen/scoutspiele";

// Automatische Auswertung der Scoutspiele gegen einen Gegner (Marcus, 31.10.2026). Je Spiel die eigene Taktik über die
// Startaufstellung bestimmen (taktik-archiv.ts, Toleranz wie bei eigenen Spielen; sonst "nicht zugeordnet"), dann je
// Taktik Siege, Remis, Niederlagen, Tore und Ballbesitz. Ergebnis im selben Format wie die von Marcus gelieferten Berichte,
// damit der Taktikvorschlag (scoutEntscheidung) es direkt nutzt.
export type ScoutSpielZeile = { mid: number; datum: string | null; reiter: string; tore: string; ergebnis: "S" | "U" | "N"; ballbesitz?: number };

export function scoutAuswertung(db: Database.Database, tid: number): { bericht: ScoutBericht; spiele: ScoutSpielZeile[] } | undefined {
  const spiele = ladeScoutSpiele(db, tid);
  if (!spiele.length) return undefined;
  const archiv = archivLaden(db);
  const zeilen: ScoutSpielZeile[] = [];
  const je = new Map<string, ScoutTaktik & { besitz: number[] }>();
  for (const s of spiele) {
    const ich = s.spiel.teams.find((t) => t.id === TEAM.tid);
    const er = s.spiel.teams.find((t) => t.id !== TEAM.tid);
    if (!ich || !er) continue;
    const reiter = taktikZuordnen(s.spiel, archiv)?.reiter ?? "nicht zugeordnet";
    const t1 = Number(ich.statistik.goals ?? 0);
    const t2 = Number(er.statistik.goals ?? 0);
    const ergebnis = t1 > t2 ? "S" : t1 === t2 ? "U" : "N";
    const besitz = ich.statistik.possession !== undefined ? Number(ich.statistik.possession) : undefined;
    zeilen.push({ mid: s.mid, datum: s.datum, reiter, tore: `${t1}:${t2}`, ergebnis, ballbesitz: besitz });
    const x = je.get(reiter) ?? {
      reiter,
      einstellung: `${ich.tactic ?? "?"} / ${ich.playstyle ?? "?"} / ${ich.aggression ?? "?"}`,
      spiele: 0,
      S: 0,
      U: 0,
      N: 0,
      tore: 0,
      gegentore: 0,
      besitz: [],
    };
    x.spiele++;
    x[ergebnis]++;
    x.tore += t1;
    x.gegentore += t2;
    if (besitz !== undefined && !Number.isNaN(besitz)) x.besitz.push(besitz);
    je.set(reiter, x);
  }
  const taktiken: ScoutTaktik[] = [...je.values()]
    .map(({ besitz, ...t }) => ({ ...t, ballbesitz: besitz.length ? Math.round((besitz.reduce((a, b) => a + b, 0) / besitz.length) * 10) / 10 : undefined }))
    .sort((a, b) => b.spiele - a.spiele);
  const datum =
    spiele
      .map((s) => s.datum ?? "")
      .sort()
      .at(-1) ?? "";
  const pps = (t: ScoutTaktik) => ((3 * t.S + t.U) / t.spiele).toFixed(2).replace(".", ",");
  return {
    spiele: zeilen,
    bericht: {
      tid,
      gegner: spiele[0].gegnerName ?? `tid ${tid}`,
      datum,
      quelle: `${zeilen.length} Scoutspiele aus ManagerZone, automatisch ausgewertet (Taktik über die Startaufstellung zugeordnet)`,
      taktiken,
      befunde: taktiken.map(
        (t) => `${t.reiter}: ${t.spiele} Spiele, ${t.S} S / ${t.U} U / ${t.N} N, Tore ${t.tore}:${t.gegentore}, ${pps(t)} Punkte pro Spiel`,
      ),
      anpassungen: [],
      vorbehalte: ["Im Scoutspiel spielt der Gegner mit der Aufstellung seines letzten Ligaspiels und reagiert nicht (mz-wissen.md, Abschnitt 14)."],
    },
  };
}
