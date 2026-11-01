import { describe, expect, it } from "vitest";
import { FORMEL_SKILLS, type Skills } from "@/lib/mz/skills";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { parseTaktikXml } from "./xml";
import { pruefeTaktik } from "./pruefer";
import { abstaendeHalten, erzeugeMitWechseln, mitSpielstandRegeln, unpassendeRegelnEntfernen } from "./mit-wechseln";

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
    const zeitwechsel = t.regeln.filter((r) => r.check_time === "true" && r.time === "70" && /^\d+$/.test(r.out_player));
    expect(zeitwechsel.map((r) => r.out_player).sort()).toEqual(["2", "3"]);
    expect(e.wechsel).toHaveLength(2);
    expect(pruefeTaktik(t, kader).fehler).toEqual([]);
  });

  it("bekommt Spielstand-Regeln wie deine Reiter, ohne wirkungslose, und nur einmal", () => {
    const e = erzeugeMitWechseln({ feld, torwart: { x: 103, y: 315 }, tactics: "shortpass", playstyle: "normal", kader, spieltag: new Date("2026-11-01T00:00:00Z") });
    const r = parseTaktikXml(e.xml).regeln.filter((x) => x.check_goal_condition === "true");
    expect(r.map((x) => `${x.time} ${x.goal_condition} ${x.tactics}/${x.playstyle}/${x.aggression}`)).toEqual([
      "60 down_by_at_least no_change/offensive/aggressive",
      "65 down_by_at_least no_change/no_change/aggressive", // schon Kurzpass
      "80 tie no_change/offensive/aggressive", // 70. Führung → normal entfällt, ist schon normal
    ]);
    expect(mitSpielstandRegeln(e.xml).xml).toBe(e.xml);
  });
});

describe("Mindestabstand halten", () => {
  it("schiebt zu enge Stürmer auseinander, der vorderste an y 63 bleibt, alle drei Aufstellungen", () => {
    const p = (pid: number, x: number, y: number) => `<Pos pos="normal" pid="${pid}" x="${x}" y="${y}" x1="${x}" y1="${y}" x2="${x}" y2="${y}" pt="1" fk="1" />`;
    const xml = `<SoccerTactics>\n<Team tactics="shortpass" playstyle="normal" aggression="normal" captain="2" />\n<Pos pos="goalie" pid="1" x="103" y="315" x1="103" y1="315" x2="103" y2="315" />\n${p(2, 105, 63)}\n${p(3, 72, 96)}\n${p(4, 135, 98)}\n</SoccerTactics>`;
    const r = abstaendeHalten(xml);
    const t = parseTaktikXml(r.xml);
    const pos = (pid: number) => t.pos.find((x) => x.pid === pid)!;
    expect(pos(2).start).toEqual({ x: 105, y: 63 });
    for (const k of ["start", "alt1", "alt2"] as const) {
      const a = [2, 3, 4].map((pid) => pos(pid)[k]!);
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y)).toBeGreaterThanOrEqual(47);
    }
    expect(abstaendeHalten(r.xml).verschoben).toEqual([]);
  });
});

describe("Spielstand-Regeln einzeln ergänzen", () => {
  it("ergänzt nur fehlende Bedingungen, bestehende bleiben", () => {
    const xml = `<SoccerTactics>\n<Team tactics="wings" playstyle="offensive" aggression="normal" captain="2" />\n<TacticRule name="Taktikregel" check_time="true" time="55" check_goal_condition="true" goal_condition="down_by_at_least" goals="1" check_player_event="false" player_event_player_type="anyone" player_event="receives_yellow" out_player="no_change" in_player_id="NULL" tactics="no_change" playstyle="no_change" aggression="aggressive" formation="no_change" />\n</SoccerTactics>`;
    const r = mitSpielstandRegeln(xml);
    expect(r.regeln.map((x) => x.split(":")[0])).toEqual(["ab 65. bei 2 Toren Rückstand", "ab 70. bei Führung", "ab 80. bei Gleichstand"]);
    expect(r.xml).toContain('time="55"');
    expect(mitSpielstandRegeln(r.xml).regeln).toEqual([]);
  });
});

describe("Führungsregel nur bei offensiver Grundeinstellung", () => {
  const regel = `<TacticRule name="Taktikregel" check_time="true" time="70" check_goal_condition="true" goal_condition="ahead_by_at_least" goals="1" check_player_event="false" player_event_player_type="anyone" player_event="receives_yellow" out_player="no_change" in_player_id="NULL" tactics="no_change" playstyle="normal" aggression="no_change" formation="no_change" />`;
  const xml = (ps: string) => `<SoccerTactics>\n<Team tactics="shortpass" playstyle="${ps}" aggression="passive" captain="2" />\n\t${regel}\n</SoccerTactics>`;
  it("entfernt sie bei defensiv und ergänzt sie dort nicht", () => {
    const r = unpassendeRegelnEntfernen(xml("defensive"));
    expect(r.xml).not.toContain("ahead_by_at_least");
    expect(r.entfernt).toHaveLength(1);
    expect(mitSpielstandRegeln(r.xml).xml).not.toContain("ahead_by_at_least");
  });
  it("lässt sie bei offensiv", () => {
    expect(unpassendeRegelnEntfernen(xml("offensive")).entfernt).toEqual([]);
  });
});
