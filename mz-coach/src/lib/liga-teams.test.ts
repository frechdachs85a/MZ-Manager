import { describe, expect, it } from "vitest";
import { letzteMidJeTeam, sortiereTabelle, type TeamZusatz } from "./liga-teams";
import type { Tabelle } from "@/lib/mz/parser/tabelle";

// Erfundene Testdaten
const tab: Tabelle = {
  kopf: ["", "Mannschaft", "Pkt"],
  zeilen: [
    { zellen: ["1", "Team A", "9"], eigen: false, tid: 1, letzte: [{ ergebnis: "S", titel: "x", mid: 10 }, { ergebnis: "S", titel: "x", mid: 30 }, { ergebnis: "S", titel: "x", mid: 20 }] },
    { zellen: ["2", "Team B", "6"], eigen: true, tid: 2, letzte: [{ ergebnis: "N", titel: "x", mid: 31 }] },
    { zellen: ["3", "Team C", "3"], eigen: false, tid: 3 },
  ],
};
const z = (summe: number | null, rang: number | null): TeamZusatz => ({
  wert: summe === null ? null : { mid: 1, summe, mitWert: 11, spieler: 11 },
  rang,
});

describe("Ligatabelle mit Startelf-Wert und Weltrang", () => {
  it("nimmt je Team die größte mid der letzten Spiele", () => {
    expect([...letzteMidJeTeam(tab).entries()]).toEqual([
      [1, 30],
      [2, 31],
    ]);
  });
  it("sortiert nach Wert absteigend und Rang aufsteigend, fehlende Werte ans Ende", () => {
    const zus = new Map([
      [1, z(5, 300)],
      [2, z(9, null)],
      [3, z(null, 100)],
    ]);
    expect(sortiereTabelle(tab.zeilen, "punkte", zus).map((x) => x.tid)).toEqual([1, 2, 3]);
    expect(sortiereTabelle(tab.zeilen, "wert", zus).map((x) => x.tid)).toEqual([2, 1, 3]);
    expect(sortiereTabelle(tab.zeilen, "rang", zus).map((x) => x.tid)).toEqual([3, 1, 2]);
  });
});
