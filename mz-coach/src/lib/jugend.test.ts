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
  it("Rang 1 bis 3 mit passendem Text behalten, Rang 4 abgeben, loyale Spieler nie Abgabekandidat", () => {
    const elite = { ...sp(195, 4, 1, 3), scoutText: "Ein großartiges Talent.", scoutTextSterne: "4/1" };
    const loyal = { ...sp(196), loyal: true };
    const spitze = { ...sp(197, 3, 2), scoutText: "Ein vielseitiger Spieler.", scoutTextSterne: "3/2" };
    const schluessel = { ...sp(198, 3, 1), scoutText: "Ein vielversprechender Spieler.", scoutTextSterne: "3/1" };
    const j = jugendAuswertung([elite, loyal, spitze, schluessel]);
    expect(j.ersetzen.find((x) => x.s.nr === 197)?.vorschlag).toBe("behalten");
    expect(j.ersetzen.find((x) => x.s.nr === 198)?.vorschlag).toBe("Abgabekandidat");
    expect(j.ersetzen.find((x) => x.s.nr === 195)?.vorschlag).toBe("behalten");
    expect(j.ersetzen.find((x) => x.s.nr === 196)?.vorschlag).toBe("loyal");
  });

  it("Talente 100 bis 110, Ersetzen ab 195 mit Scout-Rang", () => {
    const j = jugendAuswertung([sp(100, 3, 2), sp(111, 3, 2), sp(195, 4, 2, 3), sp(196, 2, 1, 3), sp(197, 2, 1, 1), sp(198, 3, 1, 2)]);
    expect(j.talente.map((x) => x.s.nr)).toEqual([100]);
    expect(j.ersetzen.map((x) => x.s.nr)).toEqual([197, 196, 198, 195]);
    expect(j.ersetzen.at(-1)).toMatchObject({ regelOk: true, einstufung: "Spitzenklasse" });
    expect(j.ersetzen[0].einstufung).toBe("Kein Platz im Kader");
    // Ohne gespeicherten Text: Rang nur aus den Sternen, deshalb "behalten, Text fehlt"
    expect(j.ersetzen.map((x) => x.vorschlag)).toEqual(["Abgabekandidat", "Abgabekandidat", "Abgabekandidat", "behalten, Text fehlt"]);
  });
});
