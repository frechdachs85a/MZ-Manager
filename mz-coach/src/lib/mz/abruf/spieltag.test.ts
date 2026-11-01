import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import { migrieren } from "@/lib/db/schema";
import { laufBeenden, laufBeginnen } from "@/lib/db/spieltag";
import type { ListenSpiel } from "@/lib/mz/parser/spielliste";

vi.mock("server-only", () => ({}));
vi.mock("./sitzung", () => ({ marke: vi.fn(), mitMzSitzung: vi.fn(), MzFehler: class extends Error {} }));

const { naechstesLigaspiel, spieltagFaellig } = await import("./spieltag");

function neueDb(zugang = true) {
  const db = new Database(":memory:");
  migrieren(db);
  if (zugang) db.prepare("INSERT INTO einstellung (schluessel, wert, geaendert) VALUES ('mz_zugang', 'x', '2026-10-26')").run();
  return db;
}
const lauf = (db: Database.Database, gestartet: string, ok: boolean, d: { letztesMid?: number; naechstesMid?: number; anstoss?: string } = {}) =>
  laufBeenden(db, laufBeginnen(db, gestartet), ok, "", d, gestartet);

const spiel = (mid: number, datum: string, zeit: string, art = "Ligaspiel", altersklasse = false): ListenSpiel => ({
  mid, datum, zeit, art, altersklasse, heim: { tid: 1, name: "A" }, gast: { tid: 2, name: "B" },
});

describe("nächstes Ligaspiel", () => {
  it("nur Senioren-Liga, noch nicht angepfiffen, frühestes zuerst", () => {
    const plan = [spiel(5, "2026-10-28", "15:00", "U18 Liga", true), spiel(6, "2026-11-01", "12:00"), spiel(4, "2026-10-28", "18:45"), spiel(3, "2026-10-26", "20:00", "Offizieller Pokal")];
    expect(naechstesLigaspiel(plan, new Date("2026-10-26T08:00:00Z"))?.mid).toBe(4);
    expect(naechstesLigaspiel(plan, new Date("2026-10-28T18:00:00Z"))?.mid).toBe(6);
  });
});

describe("Fälligkeit", () => {
  it("ohne Zugang nie, ohne bisherigen Lauf sofort", () => {
    expect(spieltagFaellig(neueDb(false))).toBeNull();
    expect(spieltagFaellig(neueDb())).toEqual({});
  });

  it("3 Stunden nach Anstoß mit Ziel, danach nicht mehr", () => {
    const db = neueDb();
    // Anstoß 28.10. 18:45 deutsche Zeit = 17:45 UTC, fällig ab 20:45 UTC
    lauf(db, "2026-10-28T08:00:00Z", true, { naechstesMid: 99, anstoss: "2026-10-28T17:45:00.000Z" });
    expect(spieltagFaellig(db, new Date("2026-10-28T20:44:00Z"))).toBeNull();
    expect(spieltagFaellig(db, new Date("2026-10-28T20:45:00Z"))).toEqual({ ziel: 99 });
    lauf(db, "2026-10-29T00:20:00Z", true, { letztesMid: 99, naechstesMid: 100, anstoss: "2026-11-01T11:00:00.000Z" });
    expect(spieltagFaellig(db, new Date("2026-10-29T01:00:00Z"))).toBeNull();
  });

  it("nach Fehlschlag 2 Stunden Pause, nach 3 Fehlschlägen nur noch täglich", () => {
    const db = neueDb();
    lauf(db, "2026-10-28T08:00:00Z", true, { naechstesMid: 99, anstoss: "2026-10-28T17:45:00.000Z" });
    lauf(db, "2026-10-29T00:30:00Z", false);
    expect(spieltagFaellig(db, new Date("2026-10-29T02:00:00Z"))).toBeNull();
    expect(spieltagFaellig(db, new Date("2026-10-29T02:31:00Z"))).toEqual({ ziel: 99 });
    lauf(db, "2026-10-29T02:31:00Z", false);
    lauf(db, "2026-10-29T04:40:00Z", false);
    expect(spieltagFaellig(db, new Date("2026-10-29T07:00:00Z"))).toBeNull();
    expect(spieltagFaellig(db, new Date("2026-10-30T04:41:00Z"))).toEqual({ ziel: 99 });
  });

  it("ohne angekündigtes Spiel einmal täglich", () => {
    const db = neueDb();
    lauf(db, "2026-10-28T08:00:00Z", true);
    expect(spieltagFaellig(db, new Date("2026-10-29T07:00:00Z"))).toBeNull();
    expect(spieltagFaellig(db, new Date("2026-10-29T08:01:00Z"))).toEqual({});
  });
});
