import { describe, expect, it } from "vitest";
import { FORMEL_SKILLS } from "@/lib/mz/skills";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { parseTaktikXml } from "@/lib/mz/taktik/xml";
import { pruefeTaktikGegenKader } from "./taktik-check";

// Erfundene Spieler und Taktik (keine echten Daten)
const sp = (pid: number, staerke: number, opt: { ausdauer?: number; kegel?: boolean } = {}) =>
  ({
    pid,
    name: `Test ${pid}`,
    status: { aufstellbar: !opt.kegel },
    skills: Object.fromEntries(FORMEL_SKILLS.map((s) => [s, { wert: s === "ausdauer" ? (opt.ausdauer ?? staerke) : staerke }])),
  }) as unknown as SpielerDaten;
const pos = (pid: number, x: number, y: number, art = "normal") => `\t<Pos pos="${art}" pid="${pid}" x="${x}" y="${y}" x1="${x}" y1="${y}" x2="${x}" y2="${y}" pt="1" fk="1" />`;
const sub = (pid: number, y: number) => `\t<Sub pos="sub" pid="${pid}" x="228" y="${y}" x1="228" y1="${y}" x2="228" y2="${y}" pt="12" fk="12" />`;
const xml = (extra = "") =>
  [
    `<?xml version="1.0" ?>`,
    `<SoccerTactics>`,
    `\t<Team tactics="wings" playstyle="normal" aggression="normal" captain="2" />`,
    pos(1, 103, 315, "goalie"),
    pos(2, 50, 250), pos(3, 104, 250), pos(4, 158, 250),
    pos(5, 60, 180), pos(6, 104, 180), pos(7, 148, 180), pos(8, 104, 140),
    pos(9, 104, 60), pos(10, 60, 80), pos(11, 150, 80),
    sub(12, 140),
    `\t<TacticRule name="Taktikregel" check_time="true" time="60" check_goal_condition="false" goal_condition="tie" goals="1" check_player_event="false" player_event_player_type="anyone" player_event="receives_yellow" out_player="3" in_player_id="12" tactics="no_change" playstyle="no_change" aggression="no_change" formation="no_change" />`,
    extra,
    `</SoccerTactics>`,
  ].join("\n");
const tag = new Date("2026-11-01T00:00:00Z");
const basis = () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((p) => sp(p, 7, { ausdauer: 9 }));

describe("Taktik-Check", () => {
  it("lässt eine optimale Taktik unverändert", () => {
    const r = pruefeTaktikGegenKader("a", xml(), [...basis(), sp(12, 5)], tag);
    expect(r.ok).toBe(true);
    expect(r.xml).toBe(xml());
  });

  it("holt einen deutlich besseren Bankspieler in die Elf und tauscht ihn auch in Bank und Regeln", () => {
    const k = basis();
    k[2] = sp(3, 5, { ausdauer: 9 }); // Spieler 3 schwach
    const r = pruefeTaktikGegenKader("a", xml(), [...k, sp(12, 9)], tag);
    expect(r.ok).toBe(false);
    const t = parseTaktikXml(r.xml);
    expect(t.pos.map((p) => p.pid)).toContain(12);
    expect(t.pos.map((p) => p.pid)).not.toContain(3);
    expect(t.subs.map((s) => s.pid)).toEqual([3]);
    // Regel "60. 12 für 3" wird zu "60. 3 für 12"
    expect(t.regeln[0].out_player).toBe("12");
    expect(t.regeln[0].in_player_id).toBe("3");
  });

  it("ersetzt nicht aufstellbare Spieler immer", () => {
    const k = basis();
    k[3] = sp(4, 7, { kegel: true, ausdauer: 9 });
    const r = pruefeTaktikGegenKader("a", xml(), [...k, sp(12, 6)], tag);
    expect(r.aenderungen.some((a) => a.grund === "nicht aufstellbar")).toBe(true);
    expect(parseTaktikXml(r.xml).pos.map((p) => p.pid)).not.toContain(4);
  });

  it("schlägt für Ausdauer unter 8 ohne Zeitwechsel eine Wechselregel vor", () => {
    const k = basis().map((s) => (s.pid === 9 ? sp(9, 7, { ausdauer: 7 }) : sp(s.pid, 7, { ausdauer: 9 })));
    const r = pruefeTaktikGegenKader("a", xml(), [...k, sp(12, 5)], tag);
    expect(r.wechselregeln[0]).toMatch(/^70\. 12 für 9 \(Ausdauer 7\)/);
    expect(parseTaktikXml(r.xml).regeln.some((x) => x.out_player === "9" && x.time === "70")).toBe(true);
  });
});
