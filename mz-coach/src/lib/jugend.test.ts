import { describe, expect, it } from "vitest";
import type { KaderEintrag } from "@/lib/db/kader";
import { jugendAuswertung } from "./jugend";

const sp = (nr: number, hoch?: number, niedrig?: number, training?: number): KaderEintrag => ({
  pid: nr,
  name: `S${nr}`,
  nr,
  alter: 16,
  skills: {},
  scoutSterne: hoch ? { hoch, niedrig } : undefined,
  scoutTraining: training,
  quelle: "",
  abgerufen: "",
});

describe("Jugend nach der Regel von Marcus", () => {
  it("Talente 100 bis 110, Ersetzen ab 195 mit Regel 4/1 oder 4/2", () => {
    const j = jugendAuswertung([sp(100, 3, 2), sp(111, 3, 2), sp(195, 4, 2, 3), sp(196, 2, 1, 3), sp(197, 2, 1, 1), sp(198, 3, 1, 2)]);
    expect(j.talente.map((x) => x.s.nr)).toEqual([100]);
    expect(j.ersetzen.map((x) => x.s.nr)).toEqual([197, 196, 198, 195]);
    expect(j.ersetzen.at(-1)).toMatchObject({ regelOk: true, einstufung: "Spitzenklasse" });
    expect(j.ersetzen[0].einstufung).toBe("kein Platz im Kader");
  });
});
