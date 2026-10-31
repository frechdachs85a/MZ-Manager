import { describe, expect, it } from "vitest";
import { FORMEL_SKILLS } from "@/lib/mz/skills";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { parseTaktikXml } from "@/lib/mz/taktik/xml";
import { bankMitWichtigen, pruefeFreund } from "./freund-check";

// Erfundene Spieler und Taktik (keine echten Daten)
const sp = (pid: number, staerke: number) =>
  ({ pid, name: `Test ${pid}`, alter: 25, status: { aufstellbar: true }, skills: Object.fromEntries(FORMEL_SKILLS.map((s) => [s, { wert: staerke }])) }) as unknown as SpielerDaten;
const pos = (pid: number, x: number, y: number, art = "normal") => `\t<Pos pos="${art}" pid="${pid}" x="${x}" y="${y}" x1="${x}" y1="${y}" x2="${x}" y2="${y}" pt="1" fk="1" />`;
const sub = (pid: number, art: string, y: number) => `\t<Sub pos="${art}" pid="${pid}" x="228" y="${y}" x1="228" y1="${y}" x2="228" y2="${y}" pt="12" fk="12" />`;
const xml = [
  `<?xml version="1.0" ?>`,
  `<SoccerTactics>`,
  `\t<Team tactics="shortpass" playstyle="normal" aggression="normal" captain="2" />`,
  pos(1, 103, 315, "goalie"),
  pos(2, 50, 250), pos(3, 104, 250), pos(4, 158, 250), pos(5, 60, 180), pos(6, 104, 180), pos(7, 148, 180), pos(8, 104, 140), pos(9, 104, 60), pos(10, 60, 80), pos(11, 150, 80),
  sub(20, "subgoalie", 117), sub(21, "sub", 140),
  `\t<TacticRule name="Taktikregel" check_time="true" time="60" check_goal_condition="false" goal_condition="tie" goals="1" check_player_event="false" player_event_player_type="anyone" player_event="receives_yellow" out_player="3" in_player_id="21" tactics="no_change" playstyle="no_change" aggression="no_change" formation="no_change" />`,
  `</SoccerTactics>`,
].join("\n");
const kader = [...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((p) => sp(p, 7)), sp(20, 6), sp(21, 6), sp(30, 6), sp(31, 6), sp(32, 6)];
const tag = new Date("2026-11-01T00:00:00Z");

describe("freund", () => {
  it("setzt die wichtigsten auf die Bank und entfernt Einwechslungen", () => {
    const out = bankMitWichtigen(xml, [{ pid: 1, name: "Torwart", wert: 9, torwart: true }, { pid: 9, name: "Stürmer", wert: 9, torwart: false }]);
    const t = parseTaktikXml(out);
    expect(t.subs.map((s) => s.pid)).toEqual([20, 21]); // 1 und 9 stehen noch auf dem Feld: Bank bleibt
    expect(t.regeln).toHaveLength(0);
  });
  it("meldet wichtige Spieler auf dem Feld und gleichen Stil, schlägt Bank mit ihnen vor", () => {
    const wichtig = [{ pid: 9, name: "Test Neun", wert: 9, torwart: false }, { pid: 1, name: "Test Eins", wert: 8.9, torwart: true }];
    const r = pruefeFreund({ reiter: "freund", xml, stil: "4-4-2 shortpass/normal", offizielleStile: [{ reiter: "kupass", stil: "4-4-2 shortpass/normal" }], wichtig, kader, spieltag: tag });
    expect(r.probleme.some((p) => p.includes("auf dem Feld"))).toBe(true);
    expect(r.probleme.some((p) => p.includes("Gleicher Stil wie kupass"))).toBe(true);
    const t = parseTaktikXml(r.xml!);
    expect(t.pos.map((p) => p.pid)).not.toContain(9);
    expect(t.pos.map((p) => p.pid)).not.toContain(1);
    expect(t.subs.map((s) => s.pid).sort()).toEqual([1, 9]);
  });
});
