import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { migrieren } from "@/lib/db/schema";
import { speichereTaktikXml } from "@/lib/db/taktik";
import { FORMEL_SKILLS, type Skills } from "@/lib/mz/skills";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { taktikLuecken } from "./taktik-luecken";

// Erfundene Testdaten: Fünferkette, aber nur 3 starke Abwehrspieler (Zweikampf 9), die übrigen ohne Zweikampf
const sk = (zweikampf: number, torwart = 2): Skills =>
  Object.fromEntries(FORMEL_SKILLS.map((s) => [s, { wert: s === "zweikampf" ? zweikampf : s === "torwart" ? torwart : 8 }])) as Skills;
const sp = (pid: number, skills: Skills): SpielerDaten => ({ pid, name: `Test ${pid}`, alter: 25, status: { aufstellbar: true }, skills });
const pos = (pid: number, x: number, y: number, art = "normal") => `\t<Pos pos="${art}" pid="${pid}" x="${x}" y="${y}" x1="${x}" y1="${y}" x2="${x}" y2="${y}" pt="1" fk="1" />`;
const fuenferkette = [
  `<?xml version="1.0" ?>`,
  `<SoccerTactics>`,
  `\t<Team tactics="shortpass" playstyle="normal" aggression="normal" captain="2" />`,
  pos(1, 103, 315, "goalie"),
  pos(2, 30, 240), pos(3, 70, 250), pos(4, 104, 255), pos(5, 138, 250), pos(6, 178, 240),
  pos(7, 70, 170), pos(8, 104, 160), pos(9, 138, 170),
  pos(10, 80, 70), pos(11, 128, 70),
  `</SoccerTactics>`,
].join("\n");

describe("Fehlende Spielertypen in deinen Reitern", () => {
  it("meldet zwei fehlende Abwehrspieler für die Fünferkette, nicht für freund", () => {
    const db = new Database(":memory:");
    migrieren(db);
    speichereTaktikXml(db, "532de", fuenferkette, "Test");
    speichereTaktikXml(db, "freund", fuenferkette, "Test");
    const kader = [sp(1, sk(2, 10)), sp(2, sk(9)), sp(3, sk(9)), sp(4, sk(9)), ...[5, 6, 7, 8, 9, 10, 11, 12].map((p) => sp(p, sk(1)))];
    const l = taktikLuecken(db, kader, 7);
    expect(l.map((x) => x.name)).toEqual(["532de"]);
    expect(l[0].plaetze.filter((p) => p.rolle === "VT")).toHaveLength(2);
  });
});
