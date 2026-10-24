import { describe, expect, it } from "vitest";
import { FORMEL_SKILLS, type Skills } from "./skills";
import { GEWICHTE, mzWert, POSITIONEN } from "./formel";

function alle(wert: number): Skills {
  return Object.fromEntries(FORMEL_SKILLS.map((s) => [s, { wert }]));
}

describe("MZ-Formel", () => {
  it("Gewichte jeder Position ergeben zusammen 1", () => {
    for (const p of POSITIONEN) {
      const summe = Object.values(GEWICHTE[p]).reduce((a, b) => a + b, 0);
      expect(summe, p).toBeCloseTo(1, 10);
    }
  });

  it("übernimmt die Gewichte aus mz-wissen.md", () => {
    expect(GEWICHTE.TW.torwart).toBe(0.55);
    expect(GEWICHTE.VT.zweikampf).toBe(0.3);
    expect(GEWICHTE.Sturm.schuss).toBe(0.28);
    expect(GEWICHTE.Flügel.flanken).toBe(0.15);
    expect(GEWICHTE.Anchorman.kopfball).toBe(0.02);
    expect(GEWICHTE.MF.passen).toBe(0.15);
  });

  it("alle Skills 10 ergibt 10 auf jeder Position", () => {
    for (const p of POSITIONEN) expect(mzWert(alle(10), p)).toEqual({ ok: true, wert: 10 });
  });

  it("rechnet Summe Skill mal Gewicht", () => {
    // VT: Sprint 9, Zweikampf 10, Rest 8
    const s = { ...alle(8), sprint: { wert: 9 }, zweikampf: { wert: 10 } };
    // 8 + 0.25*1 + 0.30*2 = 8.85
    expect(mzWert(s, "VT")).toEqual({ ok: true, wert: 8.85 });
  });

  it("Standards und Form zählen nicht", () => {
    const s = { ...alle(7), standards: { wert: 10 }, form: { wert: 1 } };
    expect(mzWert(s, "MF")).toEqual({ ok: true, wert: 7 });
  });

  it("gibt keinen Wert, wenn ein gewichteter Skill fehlt", () => {
    const s = alle(9);
    delete s.torwart;
    expect(mzWert(s, "TW")).toEqual({ ok: false, fehlend: ["torwart"] });
    // für VT hat Torwart Gewicht 0, also trotzdem berechenbar
    expect(mzWert(s, "VT")).toEqual({ ok: true, wert: 9 });
  });
});
