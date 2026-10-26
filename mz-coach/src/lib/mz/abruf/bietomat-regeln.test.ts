import { describe, expect, it } from "vitest";
import { gebotErlaubt, inEuro, naechsterSchritt } from "./bietomat-regeln";

const ICH = 1;
const t0 = Date.UTC(2026, 9, 26, 16, 0);
const min = 60_000;

describe("Bietomat-Regeln", () => {
  it("nie über dem Endpreis, auch nicht um 1 Euro", () => {
    expect(gebotErlaubt(1_000_000, 1, 1_000_000)).toEqual({ ok: true, eur: 1_000_000 });
    expect(gebotErlaubt(1_000_001, 1, 1_000_000).ok).toBe(false);
    // Fremdwährung: aufrunden, damit Rundung nie über den Endpreis führt
    expect(inEuro(100, 1.005)).toBe(101);
    expect(gebotErlaubt(500_000, 0.92, 460_000)).toEqual({ ok: true, eur: 460_000 });
    expect(gebotErlaubt(500_001, 0.92, 460_000).ok).toBe(false);
    expect(gebotErlaubt(500_000, undefined, 9_000_000).ok).toBe(false);
    expect(gebotErlaubt(NaN, 1, 9_000_000).ok).toBe(false);
  });

  it("wartet bis 3 Minuten vor Ende", () => {
    const s = naechsterSchritt({ gefunden: true, endeMs: t0 + 10 * min, bieterTid: 2 }, { eigeneTid: ICH }, t0);
    expect(s).toMatchObject({ art: "warten" });
  });

  it("bietet in den letzten 3 Minuten, wenn ein anderer vorne liegt oder noch niemand geboten hat", () => {
    expect(naechsterSchritt({ gefunden: true, endeMs: t0 + 3 * min, bieterTid: 2 }, { eigeneTid: ICH }, t0)).toEqual({ art: "bieten" });
    expect(naechsterSchritt({ gefunden: true, endeMs: t0 + 2 * min }, { eigeneTid: ICH }, t0)).toEqual({ art: "bieten" });
  });

  it("bietet nicht, wenn du Höchstbietender bist, prüft aber weiter (Verlängerung)", () => {
    const s = naechsterSchritt({ gefunden: true, endeMs: t0 + 1 * min, bieterTid: ICH }, { eigeneTid: ICH }, t0);
    expect(s).toMatchObject({ art: "warten" });
  });

  it("nach Verlängerung und Überbieten wieder bieten", () => {
    // Ende war t0, durch fremdes Gebot auf t0 + 3 Min verlängert
    expect(naechsterSchritt({ gefunden: true, endeMs: t0 + 3 * min, bieterTid: 2 }, { eigeneTid: ICH, letztesEndeMs: t0 }, t0 + 10_000)).toEqual({ art: "bieten" });
  });

  it("endet, wenn die Auktion vorbei ist", () => {
    expect(naechsterSchritt({ gefunden: false }, { eigeneTid: ICH, letzterBieter: ICH, letztesEndeMs: t0 }, t0 + 2 * min)).toMatchObject({ art: "fertig", status: "beendet" });
    expect(naechsterSchritt({ gefunden: true, endeMs: t0, bieterTid: 2 }, { eigeneTid: ICH }, t0 + 2 * min)).toMatchObject({ art: "fertig" });
  });

  it("bietet auch nach mehreren Verlängerungen weiter, solange der Endpreis reicht (keine Zeitgrenze)", () => {
    // Ursprüngliches Ende t0, durch Gebote dreimal um 3 Minuten verlängert
    expect(naechsterSchritt({ gefunden: true, endeMs: t0 + 9 * min + 2 * min, bieterTid: 2 }, { eigeneTid: ICH, letztesEndeMs: t0 }, t0 + 9 * min)).toEqual({ art: "bieten" });
  });
});
