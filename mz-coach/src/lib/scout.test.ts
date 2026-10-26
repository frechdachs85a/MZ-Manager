import { describe, expect, it } from "vitest";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { scoutEinstufung, skillPrognose } from "./scout";

// Künstliche Spieler (keine echten Daten)
const sp = (hoch?: number, niedrig?: number, text?: string, extra: Partial<SpielerDaten> = {}): SpielerDaten => ({
  pid: 1,
  name: "Test",
  skills: {},
  ...(hoch !== undefined ? { scoutSterne: { hoch, niedrig } } : {}),
  ...(text ? { scoutText: text, scoutTextSterne: `${hoch}/${niedrig}` } : {}),
  ...extra,
});

describe("Scout-Einstufung", () => {
  it("Sterne und Schlüsselwort passen: Rang", () => {
    expect(scoutEinstufung(sp(4, 2, "Er hat erstaunliches Potenzial."))).toMatchObject({ status: "ok", rang: 1, abzeichen: "Spitzenklasse" });
    expect(scoutEinstufung(sp(4, 1, "Ein Elitespieler."))).toMatchObject({ status: "ok", rang: 2, abzeichen: "Elite" });
    expect(scoutEinstufung(sp(3, 2, "Sehr vielseitig."))).toMatchObject({ status: "ok", rang: 3 });
  });

  it("„vielseitig, aber keine wirklichen Hauptstärken“ ist Rang 5, nicht Rang 3", () => {
    expect(scoutEinstufung(sp(2, 2, "Er ist vielseitig, aber keine wirklichen Hauptstärken."))).toMatchObject({ status: "ok", rang: 5 });
    expect(scoutEinstufung(sp(3, 2, "Er ist vielseitig, aber keine wirklichen Hauptstärken.")).status).toBe("unbekannt");
    // Echter Wortlaut von ManagerZone (26.10.2026)
    expect(scoutEinstufung(sp(2, 2, "Arthur Brandt ist vielseitig, scheint aber keine wirklichen Hauptstärken zu haben."))).toMatchObject({ status: "ok", rang: 5 });
  });

  it("nicht passend, unbekannter Begriff oder unbekannte Sterne: unbekannt, nicht raten", () => {
    expect(scoutEinstufung(sp(4, 2, "Ein großartiges Talent.")).status).toBe("unbekannt");
    expect(scoutEinstufung(sp(4, 2, "Ein Spieler der Weltklasse mit erstaunliches Potenzial.")).grund).toContain("Weltklasse");
    expect(scoutEinstufung(sp(1, 2, "Irgendein Text.")).status).toBe("unbekannt");
    expect(scoutEinstufung(sp(3, 1, "Ein ganz neuer Satz.")).grund).toBe("kein bekanntes Schlüsselwort im Text");
  });

  it("Text zu alten Sternen: neu abrufen", () => {
    const s = sp(4, 2, "erstaunliches Potenzial", { scoutTextSterne: "3/2" });
    expect(scoutEinstufung(s)).toMatchObject({ status: "unbekannt" });
  });

  it("ohne Text nur vorläufig, ohne Bericht „-“, loyal getrennt", () => {
    expect(scoutEinstufung(sp(4, 1))).toMatchObject({ status: "ohneText", rang: 2 });
    expect(scoutEinstufung(sp()).status).toBe("keiner");
    expect(scoutEinstufung(sp(undefined, undefined, undefined, { loyal: true })).status).toBe("loyal");
  });

  it("bestätigte neue Kombination gilt", () => {
    const k = [{ rang: 0, hoch: 5, niedrig: 2, schluessel: ["Weltstar"], abzeichen: "Weltstar" }];
    expect(scoutEinstufung(sp(5, 2, "Ein Weltstar."), k)).toMatchObject({ status: "ok", rang: 0 });
  });
});

describe("Prognose", () => {
  it("Stärken, Schwächen, rote Skills", () => {
    const s = sp(4, 1, undefined, {
      skills: { schuss: { wert: 8 }, kopfball: { wert: 4, gemaxt: true }, passen: { wert: 5 } },
      scoutMarkierung: { schuss: 1, passen: 2 },
    });
    const p = skillPrognose(s).skills;
    expect(p.find((x) => x.skill === "schuss")).toMatchObject({ art: "Stärke", prognose: "mindestens eine Stärke wird 10" });
    expect(p.find((x) => x.skill === "passen")).toMatchObject({ art: "Schwäche", prognose: "endet ca. bei 4 bis 5" });
    expect(p.find((x) => x.skill === "kopfball")?.prognose).toBe("ausgemaxt (rot), sicher");
    expect(p.find((x) => x.skill === "sprint")?.prognose).toBe("offen, höchstens so hoch wie die Stärken");
  });
});
