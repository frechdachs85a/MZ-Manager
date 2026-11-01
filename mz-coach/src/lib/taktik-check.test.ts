import { describe, expect, it } from "vitest";
import { FORMEL_SKILLS } from "@/lib/mz/skills";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { parseTaktikXml } from "@/lib/mz/taktik/xml";
import { pruefeTaktikGegenKader } from "./taktik-check";

// Erfundene Spieler und Taktik (keine echten Daten)
const sp = (pid: number, staerke: number, opt: { ausdauer?: number; kegel?: boolean; alter?: number; nr?: number } = {}) =>
  ({
    pid,
    name: `Test ${pid}`,
    alter: opt.alter ?? 17,
    nr: opt.nr,
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

describe("Taktik-Check: höchstens 3 Wechsel", () => {
  it("vergibt Ausdauer-Wechsel nach Wichtigkeit und meldet, wer leer ausgeht", () => {
    // Regel 60. 12 für 3 belegt schon einen Wechsel; vier Startspieler mit Ausdauer unter 8
    const k = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((p) => sp(p, 7, { ausdauer: { 5: 7, 6: 5, 7: 6, 8: 7 }[p] ?? 9 }));
    const bank = [12, 13, 14, 15].map((p) => sp(p, 5, { ausdauer: 9 }));
    const x = xml(`${sub(13, 163)}\n${sub(14, 186)}\n${sub(15, 209)}`);
    const r = pruefeTaktikGegenKader("a", x, [...k, ...bank], tag);
    const neu = parseTaktikXml(r.xml).regeln.filter((g) => g.time === "70");
    // Nur 2 Wechsel frei: die zwei Startspieler mit der niedrigsten Ausdauer (nach der Optimierung) bekommen sie
    const aus = (pid: number) => ({ 5: 7, 6: 5, 7: 6, 8: 7 } as Record<number, number>)[pid] ?? 9;
    const imSpiel = parseTaktikXml(r.xml).pos.filter((p) => p.pos === "normal" && aus(p.pid) < 8).map((p) => p.pid).sort((a, b) => aus(a) - aus(b));
    expect(neu.map((g) => Number(g.out_player)).sort()).toEqual(imSpiel.slice(0, 2).sort());
    expect(r.wechselregeln.filter((w) => w.includes("kein Wechsel mehr frei"))).toHaveLength(imSpiel.length - 2);
  });

  it("Altersreiter: nur Spieler im Alter, Nr. 100 bis 150 zuerst aufs Feld", () => {
    const k = basis();
    k[4] = sp(5, 9, { ausdauer: 9, alter: 19 }); // zu alt für U18
    const jung = sp(13, 5, { ausdauer: 9, nr: 120 }); // schwächer, aber Vorrang
    const r = pruefeTaktikGegenKader("U18", xml(), [...k, sp(12, 6), jung], tag, { von: 16, bis: 18 });
    const elf = parseTaktikXml(r.xml).pos.map((p) => p.pid);
    expect(elf).not.toContain(5);
    expect(elf).toContain(13);
    expect(r.aenderungen.some((a) => a.grund === "nicht im Alter 16 bis 18")).toBe(true);
  });

  it("ohne Altersgrenze kein Vorrang für Nr. 100 bis 150", () => {
    const r = pruefeTaktikGegenKader("a", xml(), [...basis(), sp(13, 5, { ausdauer: 9, nr: 120 })], tag);
    expect(r.ok).toBe(true);
  });
});
