import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { ladeKader, letzteAenderungen, speichereKader } from "./kader";
import { migrieren } from "./schema";

function frischeDb() {
  const db = new Database(":memory:");
  migrieren(db);
  return db;
}

const a: SpielerDaten = { pid: 1, name: "A", nr: 2, skills: { sprint: { wert: 9 } } };
const b: SpielerDaten = { pid: 2, name: "B", nr: 1, skills: { sprint: { wert: 7 } } };

describe("Kader-Speicher", () => {
  it("Migration ist wiederholbar", () => {
    const db = frischeDb();
    migrieren(db);
    expect(db.pragma("user_version", { simple: true })).toBe(17);
  });

  it("speichert, erkennt Änderungen und setzt Abgänge inaktiv", () => {
    const db = frischeDb();
    expect(speichereKader(db, [a, b], "test", "2026-10-24T08:00:00Z")).toEqual({ neu: 2, aenderungen: 0 });
    expect(ladeKader(db).map((s) => s.name)).toEqual(["B", "A"]);

    const a2 = { ...a, skills: { sprint: { wert: 10 } } };
    expect(speichereKader(db, [a2], "test", "2026-10-25T08:00:00Z")).toEqual({ neu: 0, aenderungen: 1 });
    expect(ladeKader(db).map((s) => s.name)).toEqual(["A"]);
    expect(letzteAenderungen(db)).toEqual([
      { pid: 1, name: "A", datum: "2026-10-25T08:00:00Z", feld: "Sprint", alt: "9", neu: "10" },
    ]);
    expect(db.prepare("SELECT COUNT(*) n FROM spieler_snapshot").get()).toEqual({ n: 3 });
  });
});
