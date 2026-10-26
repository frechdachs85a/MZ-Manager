import { describe, expect, it } from "vitest";
import { scoutBericht, scoutEntscheidung, type ScoutBericht } from "./scoutspiele";

describe("Entscheidung aus Scoutspielen", () => {
  it("Sydney: Punkte je Spiel fast gleich (1,27 / 1,36), Tordifferenz entscheidet für außenR (17:20 vor 15:23)", () => {
    const e = scoutEntscheidung(scoutBericht(97246)!);
    expect(e?.reiter).toBe("außenR");
    expect(e?.begruendung).toContain("außenR 1,27");
    expect(e?.begruendung).toContain("kupass 1,36");
  });

  it("deutlicher Abstand bei den Punkten entscheidet, zu wenige Spiele: keine Entscheidung", () => {
    const b = (a: number, k: number): ScoutBericht => ({
      tid: 1, gegner: "X", datum: "", quelle: "", befunde: [], anpassungen: [], vorbehalte: [],
      taktiken: [
        { reiter: "A", einstellung: "", spiele: a, S: 6, U: 0, N: 4, tore: 10, gegentore: 12 },
        { reiter: "B", einstellung: "", spiele: k, S: 3, U: 0, N: 7, tore: 20, gegentore: 5 },
      ],
    });
    expect(scoutEntscheidung(b(10, 10))?.reiter).toBe("A");
    expect(scoutEntscheidung(b(10, 5))).toBeNull();
  });
});
