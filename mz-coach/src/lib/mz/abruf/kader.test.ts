import Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ladeKader } from "@/lib/db/kader";
import { migrieren } from "@/lib/db/schema";
import { kaderAusDatei } from "./kader";

vi.mock("server-only", () => ({}));

// Nur lokal vorhanden (nicht im öffentlichen Repo). Fehlt sie, werden die Tests übersprungen.
const DATEI = new URL("../parser/fixtures/kader-alt-2026-10-24.html", import.meta.url);
const vorhanden = existsSync(DATEI);
const TABELLE = vorhanden ? readFileSync(DATEI, "utf8") : "";
// Die echte Seite enthält die Serverzeit in einem Skript, die Fixture nur die Tabelle.
const mitZeit = (zeit: string) => `<script>server_time = new Date(${zeit});</script>${TABELLE}`;

function frischeDb() {
  const db = new Database(":memory:");
  migrieren(db);
  return db;
}

describe.skipIf(!vorhanden)("Kader aus Datei", () => {
  it("speichert alle Spieler mit Stand aus der Serverzeit", () => {
    const db = frischeDb();
    const r = kaderAusDatei(db, mitZeit("2026, 9, 24, 22, 48, 40"), "kader.html");
    expect(r).toMatchObject({ ok: true, spieler: 47, neu: 47, aenderungen: 0, stand: "2026-10-24T20:48:40.000Z" });
    const peschke = ladeKader(db).find((s) => s.pid === 229926290)!;
    expect(peschke.abgerufen).toBe("2026-10-24T20:48:40.000Z");
    expect(peschke.quelle).toContain("?p=players&sub=alt");
  });

  it("dieselbe Seite nicht doppelt, ältere nicht über neuere", () => {
    const db = frischeDb();
    kaderAusDatei(db, mitZeit("2026, 9, 24, 22, 48, 40"), "a.html");
    expect(kaderAusDatei(db, mitZeit("2026, 9, 24, 22, 48, 40"), "a.html")).toMatchObject({ ok: false, meldung: expect.stringContaining("schon eingelesen") });
    expect(kaderAusDatei(db, mitZeit("2026, 9, 23, 10, 0, 0"), "alt.html")).toMatchObject({ ok: false, meldung: expect.stringContaining("älter") });
    expect(db.prepare("SELECT count(*) AS n FROM spieler_snapshot").get()).toEqual({ n: 47 });
  });

  it("erkennt Änderungen gegenüber dem letzten Stand", () => {
    const db = frischeDb();
    kaderAusDatei(db, mitZeit("2026, 9, 24, 22, 48, 40"), "a.html");
    // Kaupa Sprint 6 -> 5 (konstruiert für den Test)
    const html = mitZeit("2026, 9, 25, 9, 0, 0").replace(
      /(pid=226471405[\s\S]*?<td align="right">67<\/td><td align="right" class="maxed">)6</,
      "$15<",
    );
    expect(html).not.toBe(mitZeit("2026, 9, 25, 9, 0, 0"));
    expect(kaderAusDatei(db, html, "b.html")).toMatchObject({ ok: true, aenderungen: 1 });
  });

  it("falsche Datei: klare Meldung, nichts gespeichert", () => {
    const db = frischeDb();
    expect(kaderAusDatei(db, "<html><title>Logout - Managerzone</title></html>", "x.html")).toMatchObject({ ok: false, meldung: expect.stringContaining("#playerAltViewTable") });
    expect(ladeKader(db)).toHaveLength(0);
  });
});
