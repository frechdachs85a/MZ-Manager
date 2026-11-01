import { describe, expect, it } from "vitest";
import { elfMitZugaengen } from "./zugaenge";
import { FORMEL_SKILLS, type Skills } from "@/lib/mz/skills";
import { schwachstellen } from "@/lib/mz/analyse/markt";
import type { MarktSpieler } from "@/lib/mz/parser/transfer";

// Erfundene Testdaten: alle Formel-Skills gleich hoch
const sk = (w: number): Skills => Object.fromEntries(FORMEL_SKILLS.map((s) => [s, { wert: w }])) as Skills;
const elf = [
  { pid: 1, x: 100, y: 300, torwart: false }, // VT
  { pid: 2, x: 100, y: 150, torwart: false }, // MF
];
const kader = [
  { pid: 1, name: "Abwehr Alt", skills: sk(6) },
  { pid: 2, name: "Mitte Alt", skills: sk(8) },
];
const zugang = { pid: 9, name: "Neu Zugang", alter: 21, skills: sk(9), markt: { kasten: "" } } as MarktSpieler;

describe("Zugänge in den Schwachstellen", () => {
  it("Zugang übernimmt den Platz mit dem größten Gewinn, danach ist die andere Stelle die schwächste", () => {
    const vorher = schwachstellen(elf, kader).liste[0];
    expect(vorher.spieler.pid).toBe(1);
    const m = elfMitZugaengen(elf, kader, [zugang]);
    expect(m.ersetzt[0]).toMatchObject({ zugang: "Neu Zugang", statt: "Abwehr Alt" });
    const nachher = schwachstellen(m.elf, m.kader).liste[0];
    expect(nachher.spieler.pid).toBe(2);
  });
  it("Zugang ohne Verbesserung ändert nichts", () => {
    const m = elfMitZugaengen(elf, kader, [{ ...zugang, skills: sk(5) }]);
    expect(m.ersetzt).toEqual([]);
    expect(m.elf.map((s) => s.pid)).toEqual([1, 2]);
  });
});
