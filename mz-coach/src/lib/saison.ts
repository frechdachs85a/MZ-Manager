import type Database from "better-sqlite3";
import { LIGA_MID_AB } from "@/lib/mz/parser/spielliste";
import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { TEAM } from "@/lib/wissen/startbasis";

// Eigene Ligaspiele der laufenden Saison aus den gespeicherten Stats-XML (type="1" = Ligaspiel,
// mid > LIGA_MID_AB = Saison wie in mz-wissen.md, Abschnitt 2)
export type SaisonSpiel = {
  mid: number;
  datum?: string;
  gegner: string;
  heim: boolean;
  eigen: number;
  gegnerTore: number;
  ergebnis: "S" | "U" | "N";
  ballbesitz?: number;
  schuesseAufsTor?: number;
};

const zahl = (v?: string) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

export function saisonAuswertung(db: Database.Database, tid = TEAM.tid) {
  const rows = db.prepare("SELECT auswertung_json FROM spiel WHERE auswertung_json IS NOT NULL AND mid > ?").all(LIGA_MID_AB) as {
    auswertung_json: string;
  }[];
  const stats = rows
    .map((r) => JSON.parse(r.auswertung_json) as StatsSpiel)
    .filter((s) => s.typ === "1" && s.teams.some((t) => t.id === tid))
    .sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""));
  const spiele: SaisonSpiel[] = stats.map((s) => {
    const e = s.teams.find((t) => t.id === tid)!;
    const g = s.teams.find((t) => t.id !== tid)!;
    const eigen = Number(e.statistik.goals ?? NaN);
    const gegnerTore = Number(g.statistik.goals ?? NaN);
    return {
      mid: s.mid,
      datum: s.datum,
      gegner: g.name,
      heim: e.heim,
      eigen,
      gegnerTore,
      ergebnis: eigen > gegnerTore ? "S" : eigen < gegnerTore ? "N" : "U",
      ballbesitz: zahl(e.statistik.possession),
      schuesseAufsTor: zahl(e.statistik.shotsOnGoal),
    };
  });
  const tore = new Map<string, number>();
  const vorlagen = new Map<string, number>();
  for (const s of stats) {
    const name = new Map(s.spieler.map((p) => [p.id, p.name]));
    for (const t of s.tore.filter((x) => x.teamId === tid)) {
      const n = name.get(t.schuetze) ?? `id ${t.schuetze}`;
      tore.set(n, (tore.get(n) ?? 0) + 1);
      if (t.vorlage) {
        const v = name.get(t.vorlage) ?? `id ${t.vorlage}`;
        vorlagen.set(v, (vorlagen.get(v) ?? 0) + 1);
      }
    }
  }
  const schnitt = (w: (number | undefined)[]) => {
    const z = w.filter((x): x is number => x !== undefined);
    return z.length ? z.reduce((a, b) => a + b, 0) / z.length : undefined;
  };
  const sortiert = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    spiele,
    bilanz: { S: spiele.filter((s) => s.ergebnis === "S").length, U: spiele.filter((s) => s.ergebnis === "U").length, N: spiele.filter((s) => s.ergebnis === "N").length },
    tore: spiele.reduce((n, s) => n + s.eigen, 0),
    gegentore: spiele.reduce((n, s) => n + s.gegnerTore, 0),
    ballbesitz: schnitt(spiele.map((s) => s.ballbesitz)),
    schuesseAufsTor: schnitt(spiele.map((s) => s.schuesseAufsTor)),
    torschuetzen: sortiert(tore),
    vorlagengeber: sortiert(vorlagen),
  };
}
