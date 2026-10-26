import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { migrieren } from "./schema";
import { ladeAuftraege, ladeProtokoll, loescheAuftrag, protokolliere, speichereAuftrag } from "./gebot";

describe("Bietomat-Aufträge", () => {
  it("speichert, überschreibt und löscht", () => {
    const db = new Database(":memory:");
    migrieren(db);
    speichereAuftrag(db, { pid: 1, name: "Test", maximum: 500_000, status: "aktiv" });
    speichereAuftrag(db, { pid: 1, name: "Test", maximum: 600_000, bietenBis: "2026-10-28T17:00:00.000Z", status: "aktiv" });
    expect(ladeAuftraege(db)).toMatchObject([{ pid: 1, maximum: 600_000, bietenBis: "2026-10-28T17:00:00.000Z" }]);
    protokolliere(db, 1, "x", 600_000);
    expect(ladeProtokoll(db, 1)).toMatchObject([{ pid: 1, betrag: 600_000, text: "x" }]);
    loescheAuftrag(db, 1);
    expect(ladeAuftraege(db)).toEqual([]);
  });
});
