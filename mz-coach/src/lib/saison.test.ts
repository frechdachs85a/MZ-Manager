import Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrieren } from "@/lib/db/schema";
import { speichereSpiel } from "@/lib/db/spiele";
import { parseStatsXml } from "@/lib/mz/parser/stats";
import { saisonAuswertung } from "./saison";

// Eigenes Ligaspiel vom 21.10.2026 (FFK Kosova 0:9 FC Toho), nur lokal
const F = new URL("./mz/parser/fixtures/stats-1625669278.xml", import.meta.url);

describe.skipIf(!existsSync(F))("Saisonstatistik", () => {
  it("zählt das 9:0 als Sieg und alle 9 Tore bei den Torschützen", () => {
    const db = new Database(":memory:");
    migrieren(db);
    const xml = readFileSync(F, "utf8");
    speichereSpiel(db, parseStatsXml(xml), xml);
    const a = saisonAuswertung(db);
    expect(a.bilanz).toEqual({ S: 1, U: 0, N: 0 });
    expect([a.tore, a.gegentore]).toEqual([9, 0]);
    expect(a.torschuetzen.reduce((n, [, z]) => n + z, 0)).toBe(9);
    expect(a.ballbesitz).toBe(65);
  });
});
