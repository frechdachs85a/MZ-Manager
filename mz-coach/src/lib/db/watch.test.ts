import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import type { MarktSpieler } from "@/lib/mz/parser/transfer";
import { migrieren } from "./schema";
import { ladeWatchlist, nimmAufWatchlist, watchlistAufraeumen } from "./watch";

// Erfundene Spieler
const sp = (pid: number, ende: string) => ({ pid, name: `Test ${pid}`, skills: {}, markt: { ende, kasten: "" } }) as unknown as MarktSpieler;

describe("Watchlist aufräumen", () => {
  it("entfernt Spieler, deren Auktion vorbei ist; aktualisiert aus der neuesten Suche", () => {
    const db = new Database(":memory:");
    migrieren(db);
    nimmAufWatchlist(db, sp(1, "31-10-2026 10:00"));
    nimmAufWatchlist(db, sp(2, "31-10-2026 10:00"));
    nimmAufWatchlist(db, sp(3, "02-11-2026 20:00"));
    const jetzt = new Date("2026-10-31T12:00:00Z");
    // Spieler 2 ist in der neuesten Suche mit verlängertem Ende
    const weg = watchlistAufraeumen(db, [sp(2, "01-11-2026 20:00")], new Map(), jetzt);
    expect(weg).toEqual(["Test 1"]);
    expect(ladeWatchlist(db).map((w) => w.pid).sort()).toEqual([2, 3]);
  });
});
