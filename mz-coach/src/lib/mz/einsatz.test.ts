import { describe, expect, it } from "vitest";
import { einsatzImLigaspiel, tag } from "./einsatz";
import type { SpielerDaten } from "./spieler";

const basis: SpielerDaten = { pid: 1, name: "Test", skills: {} };
const imLager = (ende: string, aufstellbar: boolean): SpielerDaten => ({
  ...basis,
  status: { trainingslager: true, aufstellbar },
  trainingslagerInfo: { paket: "Torjägerpaket Nr. 5", ende, verbleibendeTage: 10 },
});
// Sonntag, 25.10.2026 (Ligaspieltag)
const SO = new Date(2026, 9, 25);

describe("Einsatz im nächsten Ligaspiel", () => {
  it("ohne Taktikseite keine Aussage", () => {
    expect(einsatzImLigaspiel(basis, SO).lage).toBe("unbekannt");
  });

  it("Trainingslager mit Chip: aufstellbar", () => {
    expect(einsatzImLigaspiel(imLager("2026-11-03", true), SO)).toMatchObject({ lage: "bereit" });
  });

  it("Kegel, Lager endet nach dem Spiel: nicht bereit, frühestens erstes Ligaspiel nach Ende", () => {
    // Ende Di 03.11. -> nächster Ligaspieltag danach Mi 04.11.
    expect(einsatzImLigaspiel(imLager("2026-11-03", false), SO)).toMatchObject({ lage: "nicht_bereit", abSpieltag: "2026-11-04" });
    // Ende Mi 04.11. (Spieltag) -> sicher erst So 08.11.
    expect(einsatzImLigaspiel(imLager("2026-11-04", false), SO)).toMatchObject({ abSpieltag: "2026-11-08" });
  });

  it("Kegel, Lager endet vor dem Spiel: wieder bereit", () => {
    expect(einsatzImLigaspiel(imLager("2026-10-24", false), SO).lage).toBe("wieder_bereit");
  });

  it("Lager endet genau am Spieltag: unklar, nicht geraten", () => {
    expect(einsatzImLigaspiel(imLager("2026-10-25", false), SO).lage).toBe("unklar");
  });

  it("Kegel ohne Trainingslager-Daten: nicht bereit, ohne Prognose", () => {
    expect(einsatzImLigaspiel({ ...basis, status: { aufstellbar: false } }, SO)).toMatchObject({ lage: "nicht_bereit" });
  });

  it("Texte ohne doppelten Punkt", () => {
    const e = einsatzImLigaspiel(imLager("2026-11-03", false), SO);
    expect(e.text).toBe("Im Trainingslager bis Di 03.11. (noch 10 Tage laut Seite), frühestens wieder am Mi 04.11.");
  });

  it("tag() nutzt den Kalendertag", () => {
    expect(tag(new Date(2026, 9, 25))).toBe("2026-10-25");
  });
});
