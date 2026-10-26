import Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { migrieren } from "@/lib/db/schema";
import { quotenJeBereich, speichereWertSpiel } from "@/lib/db/wertspiel";
import { parseStatsXml } from "@/lib/mz/parser/stats";
import type { ListenSpiel } from "@/lib/mz/parser/spielliste";

vi.mock("server-only", () => ({}));
vi.mock("./sitzung", () => ({ marke: vi.fn(), mitMzSitzung: vi.fn() }));
const { imPool, teamsAusTabelle, werteWertSpiel, wettbewerbVon } = await import("./wertscan");

describe("Wertbereich-Scan: Bausteine", () => {
  it("liest Teams aus der Tabelle mit den meisten Team-Links", () => {
    const zeile = (tid: number) => `<tr><td>${tid}</td><td><a href="/?p=team&tid=${tid}">Team ${tid}</a></td></tr>`;
    const html = `<table><tr><td><a href="/?p=team&tid=1">X</a></td></tr></table><table>${[10, 11, 12, 13, 14].map(zeile).join("")}</table>`;
    expect(teamsAusTabelle(html).map((t) => t.tid)).toEqual([10, 11, 12, 13, 14]);
    expect(teamsAusTabelle("<table></table>")).toEqual([]);
  });

  it("ordnet Liga (Saison-mids) und Weltliga zu, Jugend und Offenes nicht", () => {
    const s = (mid: number, art: string, extra: Partial<ListenSpiel> = {}): ListenSpiel => ({ mid, datum: "2026-10-01", art, altersklasse: false, heim: { name: "A" }, gast: { name: "B" }, tore: { heim: 1, gast: 0 }, ...extra });
    expect(wettbewerbVon(s(1_625_000_000, "Ligaspiel"))).toBe("liga");
    expect(wettbewerbVon(s(1_635_000_000, "Weltliga"))).toBe("weltliga");
    expect(wettbewerbVon(s(1_615_000_000, "Ligaspiel"))).toBeNull();
    expect(wettbewerbVon(s(1_625_000_000, "Ligaspiel", { altersklasse: true }))).toBeNull();
    expect(wettbewerbVon(s(1_625_000_000, "Ligaspiel", { tore: undefined }))).toBeNull();
  });

  it("Pool: höchstens 4 gleichzeitig, alle Ergebnisse in Reihenfolge", async () => {
    let laufend = 0;
    let max = 0;
    const r = await imPool(
      Array.from({ length: 10 }, (_, i) => async () => {
        laufend++;
        max = Math.max(max, laufend);
        await new Promise((x) => setTimeout(x, 5));
        laufend--;
        return i;
      }),
      4,
    );
    expect(max).toBe(4);
    expect(r).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

const DATEI = new URL("../parser/fixtures/stats-1625669278.xml", import.meta.url);
describe.skipIf(!existsSync(DATEI))("Auswertung eines echten Spiels", () => {
  const sp = parseStatsXml(readFileSync(DATEI, "utf8"));
  it("Startelf-Werte, Ergebnis aus Sicht A, gewichteter Wert mit Wechseln", () => {
    // jeder Spieler 1 Mio, FC Toho-Einwechsler 2 Mio: Startelf je 11 Mio, Feld-Wert FC Toho steigt durch Wechsel
    const einwechsler = new Set(sp.wechsel.filter((w) => w.teamId === 847159).map((w) => w.rein));
    const w = werteWertSpiel(sp, 847159, "liga", (_tid, pid) => (einwechsler.has(pid) ? 2_000_000 : 1_000_000));
    expect(w).toMatchObject({ ergebnisA: "S", toreA: 9, toreB: 0, elfA: 11_000_000, elfB: 11_000_000, verhaeltnisElf: 1, fehlendeWerte: 0 });
    expect(w.feldA!).toBeGreaterThan(11_000_000);
    expect(w.verhaeltnisFeld!).toBeGreaterThan(1);
  });
});

describe("Quoten je Wertbereich", () => {
  it("zählt jedes Spiel aus Sicht beider Teams, nur mit vollständigen Werten", () => {
    const db = new Database(":memory:");
    migrieren(db);
    const spiel = (mid: number, v: number, e: "S" | "U" | "N", fehlend = 0) =>
      speichereWertSpiel(db, { mid, wettbewerb: "liga", tidA: 1, tidB: 2, verhaeltnisElf: v, toreA: 0, toreB: 0, ergebnisA: e, fehlendeWerte: fehlend });
    spiel(1, 1.2, "S");
    spiel(2, 1.25, "U");
    spiel(3, 0.5, "N");
    spiel(4, 1.2, "S", 1);
    const q = quotenJeBereich(db);
    const b = (n: string) => q.find((x) => x.bereich === n)!;
    expect(b("1,15 bis 1,30")).toMatchObject({ spiele: 2, S: 1, U: 1, N: 0 });
    expect(b("0,85 bis 1,00")).toMatchObject({ spiele: 0 });
    expect(b("über 1,30")).toMatchObject({ spiele: 1, S: 1 }); // 1/0,5 = 2
    expect(b("unter 0,85")).toMatchObject({ spiele: 3, S: 0, U: 1, N: 2 }); // 0,5 sowie 1/1,2 = 0,83 und 1/1,25 = 0,8
  });
});

describe("Neu berechnen aus gespeicherter Aufstellung", async () => {
  const { berechneWerte } = await import("./wertscan");
  it("rechnet Startelf- und Feld-Wert ohne Abruf aus Aufstellung und Wechseln", () => {
    const w = berechneWerte(
      {
        mid: 1, wettbewerb: "liga", tidA: 1, tidB: 2, toreA: 1, toreB: 0, ergebnisA: "S", fehlendeWerte: 0,
        aufstellung: { a: { elf: [11, 12], wechsel: [{ minute: 45, raus: 12, rein: 13 }] }, b: { elf: [21, 22], wechsel: [] } },
      },
      (_t, pid) => ({ 11: 100, 12: 100, 13: 300, 21: 100, 22: 100 } as Record<number, number>)[pid],
    );
    expect(w).toMatchObject({ elfA: 200, elfB: 200, verhaeltnisElf: 1, fehlendeWerte: 0 });
    expect(w.feldA).toBe(300); // 45 min 200, 45 min 400
    expect(w.verhaeltnisFeld).toBe(1.5);
    const ohne = berechneWerte({ ...w, fehlendeWerte: 0 }, () => undefined);
    expect(ohne.fehlendeWerte).toBe(5);
  });
});
