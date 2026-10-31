import { describe, expect, it } from "vitest";
import { taktikFolgen } from "./baelle-taktik";
import type { TaktikCheck } from "./taktik-check";

// Erfundene Testdaten
const xml = (...pids: number[]) => pids.map((p) => `<Pos pos="normal" pid="${p}" x="1" y="1" />`).join("\n") + `\n<Sub pid="9" />`;
const check = (reiter: string, neu: string, aenderungen: TaktikCheck["aenderungen"] = []): TaktikCheck => ({
  reiter,
  ok: false,
  aenderbar: true,
  aenderungen,
  wechselregeln: [],
  gewinn: 0,
  xml: neu,
});

describe("Taktik-Folgen der Bälle", () => {
  it("erkennt neu drin, raus mit Grund und Stammplatz", () => {
    const checks = [
      check("A", xml(1, 2), [{ rolle: "MF", x: 1, y: 1, alt: "Meier", neu: "Muster", neuWert: 8 }]),
      check("B", xml(3, 4), [{ rolle: "MF", x: 1, y: 1, alt: "Muster", neu: "Schulz", neuWert: 8 }]),
      check("C", xml(5, 6)),
    ];
    const aktuell = [
      { reiter: "A", xml: xml(7, 2) },
      { reiter: "B", xml: xml(1, 4) },
      { reiter: "C", xml: xml(1, 6) },
    ];
    const f = taktikFolgen(checks, aktuell, { jetzt: xml(1), vorher: xml(2) }, { pid: 1, name: "Max Muster", schlechter: false });
    expect(f).toEqual([
      { reiter: "A", art: "neu", grund: "statt Meier" },
      { reiter: "B", art: "raus", grund: "Schulz ist besser" },
      { reiter: "C", art: "raus", grund: undefined },
      { reiter: "Liga", art: "liga-neu" },
    ]);
  });
  it("Bank zählt nicht als Startelf", () => {
    const f = taktikFolgen([check("A", xml(1))], [{ reiter: "A", xml: xml(1) }], {}, { pid: 9, name: "Bank Spieler", schlechter: false });
    expect(f).toEqual([]);
  });
});
