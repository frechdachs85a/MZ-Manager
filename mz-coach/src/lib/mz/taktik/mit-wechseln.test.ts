import { describe, expect, it } from "vitest";
import { FORMEL_SKILLS, type Skills } from "@/lib/mz/skills";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { parseTaktikXml } from "./xml";
import { pruefeTaktik } from "./pruefer";
import { erzeugeMitWechseln } from "./mit-wechseln";

// Erfundene Testdaten: zwei Startspieler mit Ausdauer 7, genug Bank
const sk = (w: number, ausdauer = 9, torwart = 2): Skills =>
  Object.fromEntries(FORMEL_SKILLS.map((s) => [s, { wert: s === "ausdauer" ? ausdauer : s === "torwart" ? torwart : w }])) as Skills;
const sp = (pid: number, skills: Skills): SpielerDaten => ({ pid, name: `Test ${pid}`, alter: 25, status: { aufstellbar: true }, skills });
const kader = [
  sp(1, sk(6, 9, 10)),
  sp(2, sk(9, 7)),
  sp(3, sk(9, 7)),
  ...[4, 5, 6, 7, 8, 9, 10, 11].map((p) => sp(p, sk(8))),
  sp(12, sk(5, 9, 9)),
  ...[13, 14, 15, 16].map((p) => sp(p, sk(7))),
];
const feld = [
  { x: 30, y: 240 }, { x: 80, y: 240 }, { x: 130, y: 240 }, { x: 180, y: 240 },
  { x: 55, y: 170 }, { x: 104, y: 170 }, { x: 153, y: 170 },
  { x: 50, y: 90 }, { x: 104, y: 90 }, { x: 158, y: 90 },
];

describe("Neu erzeugte Taktik mit Wechselregeln", () => {
  it("bekommt für Startspieler mit Ausdauer unter 8 eine Wechselregel und besteht die Prüfliste", () => {
    const e = erzeugeMitWechseln({ feld, torwart: { x: 103, y: 315 }, tactics: "shortpass", playstyle: "normal", kader, spieltag: new Date("2026-11-01T00:00:00Z") });
    const t = parseTaktikXml(e.xml);
    const zeitwechsel = t.regeln.filter((r) => r.check_time === "true" && r.time === "70");
    expect(zeitwechsel.map((r) => r.out_player).sort()).toEqual(["2", "3"]);
    expect(e.wechsel).toHaveLength(2);
    expect(pruefeTaktik(t, kader).fehler).toEqual([]);
  });
});
