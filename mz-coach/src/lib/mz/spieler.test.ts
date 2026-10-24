import { describe, expect, it } from "vitest";
import { aenderungen, type SpielerDaten } from "./spieler";

const basis: SpielerDaten = {
  pid: 1,
  name: "Test",
  alter: 27,
  skills: { sprint: { wert: 9 }, ausdauer: { wert: 7, gemaxt: false }, form: { wert: 8 } },
  marktwert: 1000,
  status: { verletzt: false },
};

describe("aenderungen", () => {
  it("erkennt neuen Ball, Verlust, gemaxt, Marktwert und Status", () => {
    const neu: SpielerDaten = {
      ...basis,
      skills: { sprint: { wert: 8 }, ausdauer: { wert: 8, gemaxt: true }, form: { wert: 8 } },
      marktwert: 1200,
      status: { verletzt: true },
    };
    expect(aenderungen(basis, neu)).toEqual([
      { feld: "Sprint", alt: "9", neu: "8" },
      { feld: "Ausdauer", alt: "7", neu: "8" },
      { feld: "Ausdauer gemaxt", alt: "nein", neu: "ja" },
      { feld: "Marktwert", alt: "1000", neu: "1200" },
      { feld: "Verletzt", alt: "nein", neu: "ja" },
    ]);
  });

  it("fehlende Werte zählen nicht als Änderung", () => {
    const neu: SpielerDaten = { pid: 1, name: "Test", skills: {} };
    expect(aenderungen(basis, neu)).toEqual([]);
  });
});
