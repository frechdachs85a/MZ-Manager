import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStatsXml } from "@/lib/mz/parser/stats";
import { abweichung, analysiereGegner, formation } from "./gegner";

describe("Bausteine", () => {
  it("Formation nach den Zonen aus mz-wissen.md (Abwehr y >= 222, Sturm y <= 110)", () => {
    const p = (y: number) => ({ x: 100, y });
    expect(formation([p(224), p(224), p(222), p(221), p(150), p(112), p(111), p(110), p(63), p(95)]).text).toBe("3-4-3");
  });

  it("Abweichung: beste Zuordnung, nicht die Reihenfolge", () => {
    const a = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(abweichung(a, [{ x: 101, y: 0 }, { x: 0, y: 1 }])).toBeCloseTo(1, 5);
    expect(abweichung(a, [{ x: 0, y: 0 }])).toBe(Infinity);
  });
});

// Die 7 Ligaspiele von YugiPeeK (tid 97933), Saison 100, nur lokal vorhanden (Repo ist öffentlich).
const MIDS = [1625669242, 1625669247, 1625669257, 1625669263, 1625669264, 1625669272, 1625669276];
const datei = (m: number) => new URL(`../parser/fixtures/stats-${m}.xml`, import.meta.url);
const alleDa = MIDS.every((m) => existsSync(datei(m)));

describe.skipIf(!alleDa)("YugiPeeK, 7 Ligaspiele", () => {
  const a = analysiereGegner(97933, alleDa ? MIDS.map((m) => parseStatsXml(readFileSync(datei(m), "utf8"))) : []);

  it("wechselnd mit 3 Formationen, die letzten 2 Spiele gleich", () => {
    expect(a.urteil).toBe("wechselnd");
    expect(a.urteilText).toContain("3 Formationen (3-5-2, 4-4-2, 3-4-3)");
    expect(a.urteilText).toContain("Die letzten 2 Spiele waren gleich.");
    expect(a.begruendung[0]).toEqual({ mid: 1625669272, text: "gleich wie das neueste Spiel (größte Abweichung 1)" });
  });

  it("Konstanten und Bilanz", () => {
    expect(a.konstant).toContain("Härte immer aggressiv");
    expect(a.konstant).toContain("in keinem Spiel ein Wechsel");
    expect(a.bilanz).toEqual({ siege: 0, remis: 0, niederlagen: 7, tore: 8, gegentore: 26 });
  });

  it("Empfehlung nach Abschnitt 10: Standard, enge Mitte -> kupass, mit Vorbehalten", () => {
    expect(a.empfehlung.taktik).toBe("kupass");
    expect(a.empfehlung.regel).toContain("Standard-Taktik wählen, nicht anpassen");
    expect(a.empfehlung.vorbehalte[0]).toContain("In 4 von 7 Spielen andere Formation");
    expect(a.empfehlung.vorbehalte[0]).toContain("der Auslöser für die Empfehlung galt aber auch dort");
    expect(a.empfehlung.gruende).toContain("Enge Mitte in 7 von 7 Ligaspielen.");
  });
});
