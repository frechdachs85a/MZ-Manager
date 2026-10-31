import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrieren } from "@/lib/db/schema";
import { skillBilanz } from "./skill-bilanz";

// Erfundene Spieler und Änderungen
describe("skillBilanz", () => {
  it("zählt Bälle je Spieler und warnt, wenn Ausdauer unter 8 fällt", () => {
    const db = new Database(":memory:");
    migrieren(db);
    const jetzt = new Date("2026-10-30T12:00:00Z");
    const ins = db.prepare("INSERT INTO spieler (pid, name, nr, alter_jahre, daten_json, quelle, abgerufen, aktiv) VALUES (?, ?, 1, 33, '{}', 't', ?, 1)");
    ins.run(1, "Alt Spieler", jetzt.toISOString());
    ins.run(2, "Jung Spieler", jetzt.toISOString());
    const a = db.prepare("INSERT INTO spieler_aenderung (pid, datum, feld, alt, neu, quelle) VALUES (?, ?, ?, ?, ?, 't')");
    a.run(1, "2026-10-29T05:00:00Z", "Ausdauer", "8", "7");
    a.run(2, "2026-10-28T05:00:00Z", "Schuss", "6", "7");
    a.run(2, "2026-10-28T05:00:00Z", "Form", "6", "9"); // zählt nicht
    a.run(2, "2026-09-01T05:00:00Z", "Passen", "5", "6"); // zu alt
    const r = skillBilanz(db, 14, jetzt);
    expect(r.bilanz.map((b) => [b.name, b.plus, b.minus])).toEqual([["Jung Spieler", 1, 0], ["Alt Spieler", 0, 1]]);
    expect(r.warnungen).toEqual([{ pid: 1, name: "Alt Spieler", text: "Ausdauer 8 → 7: hält keine 90 Minuten mehr durch, Wechsel einplanen" }]);
  });
});
