import { describe, expect, it } from "vitest";
import { FORMEL_SKILLS } from "@/lib/mz/skills";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { ligaAusArchiv } from "./liga-anpassen";
import { parseTaktikXml } from "./xml";

// Erfundene Spieler und Taktik (keine echten Daten)
const spieler = (pid: number, staerke: number, kopfball = 5) =>
  ({ pid, name: `Test ${pid}`, skills: Object.fromEntries(FORMEL_SKILLS.map((s) => [s, { wert: s === "kopfball" ? kopfball : staerke }])) }) as unknown as SpielerDaten;
const kader = [spieler(1, 5), spieler(2, 9), spieler(3, 5), spieler(4, 5), spieler(5, 5), spieler(6, 5), spieler(7, 5), spieler(8, 5), spieler(9, 5), spieler(10, 5), spieler(11, 5), spieler(12, 5)];
const pos = (pid: number, x: number, y: number) => `\t<Pos pos="normal" pid="${pid}" x="${x}" y="${y}" x1="${x}" y1="${y}" x2="${x}" y2="${y}" pt="1" fk="1" />`;
const xml = [
  `<?xml version="1.0" ?>`,
  `<SoccerTactics>`,
  `\t<Team tactics="wings" playstyle="normal" aggression="normal" captain="2" />`,
  `\t<Pos pos="goalie" pid="12" x="103" y="315" x1="103" y1="315" x2="103" y2="315" pt="1" fk="1" />`,
  pos(1, 50, 250), pos(2, 104, 250), pos(3, 158, 250),
  pos(4, 60, 180), pos(5, 104, 180), pos(6, 148, 180), pos(7, 104, 140),
  pos(8, 104, 60), pos(9, 60, 80), pos(10, 180, 60),
  `\t<Sub pos="sub" pid="11" x="228" y="140" x1="228" y1="140" x2="228" y2="140" pt="12" fk="12" />`,
  `\t<TacticRule name="Taktikregel" time="70" out_player="10" in_player_id="11" />`,
  `</SoccerTactics>`,
].join("\n");

describe("ligaAusArchiv", () => {
  it("behält Elf, Bank und Regeln und stellt den stärksten Verteidiger gegenüber seinen stärksten Angreifer", () => {
    // Sein stärkster Angreifer steht bei ihm x 160 = bei dir x 48 (links)
    const r = ligaAusArchiv({ xml, kader, gegner: [{ x: 160, y: 60, wert: 1_500_000, label: "A" }, { x: 104, y: 60, wert: 500_000 }] });
    const t = parseTaktikXml(r.xml);
    const links = t.pos.find((p) => p.start.x === 50)!;
    expect(links.pid).toBe(2);
    expect(t.pos.map((p) => p.pid).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].sort());
    expect(t.subs.map((s) => s.pid)).toEqual([11]);
    expect(t.regeln).toHaveLength(1);
    expect(r.xml).toContain('out_player="10"');
  });
  it("spiegelt eine einseitige Formation zur schwächeren Seite", () => {
    const r = ligaAusArchiv({ xml, kader, gegner: [], angriffUeber: "links" });
    const t = parseTaktikXml(r.xml);
    expect(t.pos.find((p) => p.pid === 10)!.start.x).toBe(28);
  });
});
