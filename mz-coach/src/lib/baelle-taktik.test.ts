import { describe, expect, it } from "vitest";
import { FORMEL_SKILLS, type Skills } from "@/lib/mz/skills";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { taktikFolgen } from "./baelle-taktik";

// Erfundene Spieler und Taktik (keine echten Daten)
const sk = (w: number): Skills => Object.fromEntries(FORMEL_SKILLS.map((s) => [s, { wert: s === "ausdauer" ? 9 : w }])) as Skills;
const sp = (pid: number, w: number, status: SpielerDaten["status"] = { aufstellbar: true }) =>
  ({ pid, name: `Test ${pid}`, alter: 25, status, skills: sk(w) }) as SpielerDaten;
const pos = (pid: number, x: number, y: number, art = "normal") => `\t<Pos pos="${art}" pid="${pid}" x="${x}" y="${y}" x1="${x}" y1="${y}" x2="${x}" y2="${y}" pt="1" fk="1" />`;
const xml = [
  `<?xml version="1.0" ?>`,
  `<SoccerTactics>`,
  `\t<Team tactics="wings" playstyle="normal" aggression="normal" captain="2" />`,
  pos(1, 103, 315, "goalie"),
  pos(2, 50, 250), pos(3, 104, 250), pos(4, 158, 250),
  pos(5, 60, 180), pos(6, 104, 180), pos(7, 148, 180), pos(8, 104, 140),
  pos(9, 104, 60), pos(10, 60, 80), pos(11, 150, 80),
  `</SoccerTactics>`,
].join("\n");
const tag = new Date("2026-11-01T00:00:00Z");
const reiter = [{ reiter: "a", xml }];
const basis = () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((p) => sp(p, 7));

describe("Taktik-Folgen der Bälle", () => {
  it("durch die Bälle in der Startelf: vorher schwächer als alle, jetzt deutlich besser", () => {
    const neu = sp(12, 9);
    const f = taktikFolgen(reiter, [...basis(), neu], neu, sk(5), tag);
    expect(f).toEqual([{ reiter: "a", art: "neu", nachAusfall: undefined, statt: expect.any(String) }]);
  });
  it("wäre auch ohne die Bälle drin: kein „durch die Bälle“", () => {
    const k = basis();
    k[2] = sp(3, 9);
    const f = taktikFolgen(reiter, k, k[2], sk(8.5), tag);
    expect(f).toEqual([{ reiter: "a", art: "drin", nachAusfall: undefined }]);
  });
  it("im Trainingslager: gerechnet, als wäre er einsetzbar, mit Hinweis", () => {
    const neu = sp(12, 9, { aufstellbar: false, trainingslager: true });
    const f = taktikFolgen(reiter, [...basis(), neu], neu, sk(5), tag);
    expect(f[0]).toMatchObject({ reiter: "a", art: "neu", nachAusfall: "nach dem Trainingslager" });
  });
});
