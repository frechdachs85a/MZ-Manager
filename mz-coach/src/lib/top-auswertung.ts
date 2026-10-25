import type Database from "better-sqlite3";
import { ladeTeamSpiele } from "@/lib/db/gegner";
import { ladeSpiel } from "@/lib/db/spiele";
import { ladeTopTeams, type TopTeam } from "@/lib/db/top";
import { spielMuster, stilMatrix, teamMuster, type SpielMuster, type TeamMuster } from "@/lib/mz/analyse/muster";
import { auswahlLernspiele } from "@/lib/mz/abruf/top-auswahl";

export type TopTeamAuswertung = TopTeam & {
  liga: { gewaehlt: number; mitXml: number; muster: TeamMuster | null; spiele: SpielMuster[] };
  weltliga: { gewaehlt: number; mitXml: number; muster: TeamMuster | null; spiele: SpielMuster[] };
  arten: [string, number][]; // Spielarten in der gespeicherten Liste (zur Kontrolle der Weltliga-Erkennung)
};

export function topAuswertung(db: Database.Database) {
  const alle: SpielMuster[] = [];
  const teams: TopTeamAuswertung[] = ladeTopTeams(db).map((t) => {
    const spiele = ladeTeamSpiele(db, t.tid);
    const { liga, weltliga } = auswahlLernspiele(spiele);
    const auswerten = (l: typeof liga) => {
      const muster = l
        .map((s) => ladeSpiel(db, s.mid))
        .filter((s): s is NonNullable<typeof s> => !!s)
        .map((s) => spielMuster(s, t.tid));
      alle.push(...muster);
      return { gewaehlt: l.length, mitXml: muster.length, muster: muster.length ? teamMuster(muster) : null, spiele: muster };
    };
    const arten = new Map<string, number>();
    for (const s of spiele) arten.set(s.art || "?", (arten.get(s.art || "?") ?? 0) + 1);
    return { ...t, liga: auswerten(liga), weltliga: auswerten(weltliga), arten: [...arten.entries()].sort((a, b) => b[1] - a[1]) };
  });
  return { teams, matrix: stilMatrix(alle), spiele: alle.length };
}
