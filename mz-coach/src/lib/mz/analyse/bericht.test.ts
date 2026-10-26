import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStatsXml } from "@/lib/mz/parser/stats";
import { spielBericht } from "./bericht";
import { gegenIhn } from "./gegen-ihn";

// Echte Stats-XML, nur lokal vorhanden (Repo ist öffentlich, siehe .gitignore)
const fix = (mid: number) => new URL(`../parser/fixtures/stats-${mid}.xml`, import.meta.url);
const EIGEN = fix(1625669278);

describe.skipIf(!existsSync(EIGEN))("Spielbericht an Spiel 1625669278 (FC Toho auswärts)", () => {
  const b = spielBericht(parseStatsXml(readFileSync(EIGEN, "utf8")), 847159);

  it("Endstand, Halbzeit und 2. Halbzeit als Differenz", () => {
    expect(b.ergebnis).toBe("S");
    expect(b.endstand).toEqual({ eigen: 9, gegner: 0 });
    expect(b.halbzeiten?.[0].eigen.tore).toBe(3);
    expect(b.halbzeiten?.[1].eigen.tore).toBe(6);
    // Ballbesitz der 2. Halbzeit aus possessionTicks: zusammen 100 %
    const [, h2] = b.halbzeiten!;
    expect((h2.eigen.ballbesitz ?? 0) + (h2.gegner.ballbesitz ?? 0)).toBe(100);
  });

  it("Schüsse aufs Tor = Tore + Paraden des Gegners, Tore der Spieler = Teamtore", () => {
    expect((b.halbzeiten![0].eigen.schuesseTor ?? 0) + (b.halbzeiten![1].eigen.schuesseTor ?? 0)).toBe(41);
    expect(9 + (b.gegner.statistik.saves ? Number(b.gegner.statistik.saves) : 0)).toBe(41);
    expect(b.spieler.reduce((n, p) => n + p.tore, 0)).toBe(9);
    expect(b.spieler.filter((p) => p.start)).toHaveLength(11);
    expect(b.spieler.filter((p) => p.rein !== undefined)).toHaveLength(3);
  });
});

// Ligaspiele von YugiPeeK (tid 97933): er hat alle 7 verloren, Tore 8:26
const MIDS = [1625669242, 1625669247, 1625669257, 1625669263, 1625669264, 1625669272, 1625669276];
describe.skipIf(!MIDS.every((m) => existsSync(fix(m))))("Was gegen YugiPeeK funktioniert hat", () => {
  const g = gegenIhn(97933, MIDS.map((m) => parseStatsXml(readFileSync(fix(m), "utf8"))));

  it("Ergebnis aus Sicht seiner Gegner umgekehrt", () => {
    expect(g.spiele).toHaveLength(7);
    expect(g.spiele.every((s) => s.ergebnis === "S")).toBe(true);
    expect(g.spiele.reduce((n, s) => n + s.tore.fuer, 0)).toBe(26);
    expect(g.spiele.reduce((n, s) => n + s.tore.gegen, 0)).toBe(8);
    expect(g.nachTaktik.reduce((n, x) => n + x.spiele, 0)).toBe(7);
    expect(g.spiele.every((s) => s.tid !== 97933)).toBe(true);
  });
});

describe.skipIf(!MIDS.every((m) => existsSync(fix(m))))("Steckbrief YugiPeeK", async () => {
  const { steckbrief } = await import("./steckbrief");
  const b = steckbrief(97933, MIDS.map((m) => parseStatsXml(readFileSync(fix(m), "utf8"))));
  it("Bilanz, Tore und Gegentor-Minuten passen zusammen", () => {
    expect(b.bilanz).toEqual({ S: 0, U: 0, N: 7, tore: 8, gegentore: 26 });
    expect(b.spiele.reduce((n, s) => n + s.gegentorMinuten.length, 0)).toBe(26);
    expect(b.torschuetzen.reduce((n, [, x]) => n + x, 0)).toBe(8);
    expect(b.spiele[0].datum! < b.spiele.at(-1)!.datum!).toBe(true);
    expect(b.stammElf!.spiele).toBeGreaterThanOrEqual(1);
  });
});
