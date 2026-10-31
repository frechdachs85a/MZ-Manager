import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrieren } from "@/lib/db/schema";
import { speichereScoutSpiel } from "@/lib/db/scout-spiel";
import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { TEAM } from "@/lib/wissen/startbasis";
import { scoutAuswertung } from "./scout-auswertung";

// Erfundene Scoutspiele (keine echten Daten): ohne Archiv-Taktik werden sie als "nicht zugeordnet" gezählt
const spiel = (mid: number, eigen: number, gegner: number) =>
  ({
    mid,
    teams: [
      { id: TEAM.tid, name: "Wir", tactic: "wings", playstyle: "normal", aggression: "normal", statistik: { goals: String(eigen), possession: "55" } },
      { id: 1, name: "Er", tactic: "shortpass", playstyle: "normal", aggression: "normal", statistik: { goals: String(gegner), possession: "45" } },
    ],
    spieler: [],
    tore: [],
  }) as unknown as StatsSpiel;

describe("Scoutspiele auswerten", () => {
  it("zählt Siege, Remis, Niederlagen, Tore und Ballbesitz je Taktik", () => {
    const db = new Database(":memory:");
    migrieren(db);
    speichereScoutSpiel(db, { mid: 1, gegnerTid: 1, gegnerName: "Er", datum: "2026-10-31", spiel: spiel(1, 2, 0) });
    speichereScoutSpiel(db, { mid: 2, gegnerTid: 1, gegnerName: "Er", datum: "2026-10-31", spiel: spiel(2, 1, 1) });
    speichereScoutSpiel(db, { mid: 3, gegnerTid: 1, gegnerName: "Er", datum: "2026-10-31", spiel: spiel(3, 0, 3) });
    const a = scoutAuswertung(db, 1)!;
    expect(a.bericht.taktiken).toEqual([
      { reiter: "nicht zugeordnet", einstellung: "wings / normal / normal", spiele: 3, S: 1, U: 1, N: 1, tore: 3, gegentore: 4, ballbesitz: 55 },
    ]);
    expect(a.spiele.map((x) => x.ergebnis)).toEqual(["S", "U", "N"]);
    expect(scoutAuswertung(db, 2)).toBeUndefined();
  });
});
