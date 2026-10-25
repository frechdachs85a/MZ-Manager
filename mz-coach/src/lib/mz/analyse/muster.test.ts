import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStatsXml } from "@/lib/mz/parser/stats";
import { lageAus, spielMuster, stilMatrix, teamMuster } from "./muster";

describe("Lage aus dem Spielstand", () => {
  it("Heim und Gast", () => {
    expect(lageAus("2:1", true)).toBe("führt");
    expect(lageAus("2:1", false)).toBe("hinten");
    expect(lageAus("0:0", true)).toBe("gleich");
  });
});

// Echte Ligaspiele von YugiPeeK (tid 97933), nur lokal (siehe .gitignore)
const MIDS = [1625669242, 1625669247, 1625669257, 1625669263, 1625669264, 1625669272, 1625669276];
const dateien = MIDS.map((m) => new URL(`../parser/fixtures/stats-${m}.xml`, import.meta.url));
const vorhanden = dateien.every((d) => existsSync(d));

describe.skipIf(!vorhanden)("Spielmuster an 7 echten Ligaspielen", () => {
  const spiele = dateien.map((d) => spielMuster(parseStatsXml(readFileSync(d, "utf8")), 97933));

  it("Ergebnis und Bilanz wie in der Gegneranalyse (0 S, 0 U, 7 N, Tore 8:26)", () => {
    const t = teamMuster(spiele);
    expect(t.bilanz).toEqual({ S: 0, U: 0, N: 7 });
    expect(spiele.reduce((n, s) => n + s.tore.eigen, 0)).toBe(8);
    expect(spiele.reduce((n, s) => n + s.tore.gegner, 0)).toBe(26);
    expect(spiele.every((s) => s.typ === "1")).toBe(true);
  });

  it("YugiPeeK wechselt nie (wie in der Gegneranalyse)", () => {
    expect(teamMuster(spiele).wechselMinuten).toEqual([]);
  });

  it("Matrix zählt jedes Spiel genau einmal", () => {
    expect(stilMatrix(spiele).reduce((n, z) => n + z.spiele, 0)).toBe(7);
  });
});

const EIGEN = new URL("../parser/fixtures/stats-1625669278.xml", import.meta.url);
describe.skipIf(!existsSync(EIGEN))("Spielverlauf im eigenen Spiel vom 21.10.", () => {
  it("drei Regelwechsel mit Regelminute, Rolle und Spielstand, zeitlich sortiert", () => {
    const m = spielMuster(parseStatsXml(readFileSync(EIGEN, "utf8")), 847159);
    expect(m.wechsel.map((w) => w.regelMinute)).toEqual([55, 60, 60]);
    expect(m.wechsel[0]).toMatchObject({ raus: "Kojiro Hyuga", rein: "Balthasar Wiesenberg", grund: "preset" });
    expect(m.wechsel[0].rolleRaus.startsWith("Sturm")).toBe(true);
    expect(m.ablauf).toHaveLength(3);
    expect(m.ablauf.map((a) => a.minute)).toEqual([...m.ablauf.map((a) => a.minute)].sort((a, b) => a - b));
    expect(teamMuster([m]).wechselNachRolle.reduce((n, w) => n + w.anzahl, 0)).toBe(3);
  });
});
