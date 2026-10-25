import { describe, expect, it } from "vitest";
import type { MarktSpieler } from "@/lib/mz/parser/transfer";
import { FORMEL_SKILLS, type Skills } from "@/lib/mz/skills";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { bewerteMarkt, mindestpreis, rolle, schwachstellen, type MarktRahmen, type Slot } from "./markt";

const alle = (w: number, extra: Partial<Record<(typeof FORMEL_SKILLS)[number], number>> = {}): Skills =>
  Object.fromEntries(FORMEL_SKILLS.map((s) => [s, { wert: extra[s] ?? w, gemaxt: true }])) as Skills;

const kader: SpielerDaten[] = [
  { pid: 1, name: "Torwart", skills: alle(8, { torwart: 10 }) },
  { pid: 2, name: "Schwacher VT", skills: alle(6) },
  { pid: 3, name: "Starker MF", skills: alle(9) },
];
const elf: Slot[] = [
  { pid: 1, x: 104, y: 310, torwart: true },
  { pid: 2, x: 76, y: 224, torwart: false },
  { pid: 3, x: 101, y: 183, torwart: false },
];
const markt = (pid: number, skills: Skills, m: Partial<MarktSpieler> = {}): MarktSpieler => ({
  pid,
  name: `Kandidat ${pid}`,
  alter: 25,
  nationalitaet: "Deutschland",
  skills,
  markt: { gefordert: 1_000_000, kasten: "" },
  ...m,
});
const rahmen = (r: Partial<MarktRahmen> = {}): MarktRahmen => ({
  kapital: 5_000_000,
  auslaenderFrei: 0,
  bewilligungenFrei: 0,
  abgelehnt: new Set(),
  eigene: new Set([1, 2, 3]),
  ...r,
});

describe("Rolle aus Editor-Koordinaten", () => {
  it("Torwart, Abwehr, Flügel, Sturm, Mittelfeld", () => {
    expect(rolle({ pid: 0, x: 104, y: 310, torwart: true })).toBe("TW");
    expect(rolle({ pid: 0, x: 26, y: 224, torwart: false })).toBe("VT");
    expect(rolle({ pid: 0, x: 200, y: 63, torwart: false })).toBe("Flügel");
    expect(rolle({ pid: 0, x: 129, y: 95, torwart: false })).toBe("Sturm");
    expect(rolle({ pid: 0, x: 101, y: 135, torwart: false })).toBe("MF");
  });
});

describe("Schwachstellen und Marktbewertung", () => {
  const { liste } = schwachstellen(elf, kader);

  it("ordnet die Startelf vom schwächsten Wert an", () => {
    expect(liste[0].spieler.name).toBe("Schwacher VT");
    expect(liste[0].wert).toBe(6);
  });

  it("empfiehlt den Spieler mit dem größten Gewinn und begründet ihn", () => {
    const e = bewerteMarkt([markt(10, alle(9)), markt(11, alle(10), { markt: { gefordert: 9_000_000, kasten: "" } })], liste, rahmen());
    expect(e.empfehlung?.kandidat.pid).toBe(10);
    expect(e.empfehlung?.ziel.spieler.name).toBe("Schwacher VT");
    expect(e.empfehlung?.gewinn).toBe(3);
    expect(e.empfehlung?.gruende[0]).toContain("Größte Schwachstelle");
    expect(e.ausgeschlossen["zu-teuer"]).toBe(1);
  });

  it("Ablehnen führt zum nächsten Kandidaten", () => {
    const k = [markt(10, alle(9)), markt(12, alle(9, { zweikampf: 8 }))];
    expect(bewerteMarkt(k, liste, rahmen()).empfehlung?.kandidat.pid).toBe(10);
    expect(bewerteMarkt(k, liste, rahmen({ abgelehnt: new Set([10]) })).empfehlung?.kandidat.pid).toBe(12);
  });

  it("99-Regel, Ausländerplätze und fehlende Verbesserung schließen aus", () => {
    const k = [
      markt(20, alle(9, { sprint: 8 })),
      markt(21, alle(9), { nationalitaet: "Polen" }),
      markt(22, alle(9, { zweikampf: 0, sprint: 9, ausdauer: 9, technik: 0, spieluebersicht: 0, passen: 0, flanken: 0, erfahrung: 0, torwart: 0 })),
    ];
    const e = bewerteMarkt(k, liste, rahmen());
    expect(e.empfehlung).toBeNull();
    expect(e.ausgeschlossen).toEqual({ "99-regel": 1, auslaender: 1, "keine-verbesserung": 1 });
    expect(bewerteMarkt([k[1]], liste, rahmen({ auslaenderFrei: 1 })).empfehlung?.kandidat.pid).toBe(21);
    const mitBewilligung = bewerteMarkt([k[1]], liste, rahmen({ bewilligungenFrei: 3 })).empfehlung;
    expect(mitBewilligung?.vorbehalte.some((v) => v.startsWith("Arbeitsbewilligung nötig"))).toBe(true);
  });

  it("Spieler vom gesperrten Verein (Team der Frau) werden nie vorgeschlagen", () => {
    const k = [markt(30, alle(9), { markt: { gefordert: 1, verkaeuferTid: 99, kasten: "" } }), markt(31, alle(9))];
    const e = bewerteMarkt(k, liste, rahmen({ gesperrteTeams: new Set([99]) }));
    expect(e.empfehlung).toBeNull();
    expect(e.ausgeschlossen).toEqual({ "gesperrter-verein": 1, "verein-unbekannt": 1 });
  });

  it("Mindestpreis ist das höhere aus gefordert und Höchstgebot", () => {
    expect(mindestpreis(markt(1, {}, { markt: { gefordert: 100, hoechstgebot: 250, kasten: "" } }))).toBe(250);
    expect(mindestpreis(markt(1, {}, { markt: { kasten: "" } }))).toBeUndefined();
  });
});
