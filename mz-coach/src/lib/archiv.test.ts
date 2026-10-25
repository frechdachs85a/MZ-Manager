import Database from "better-sqlite3";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { speichereRohseite } from "@/lib/db/abruf";
import { speichereKader } from "@/lib/db/kader";
import { speichereMarktSuche } from "@/lib/db/markt";
import { migrieren } from "@/lib/db/schema";
import { archiviereTop, aufraeumen, ladeTopArchiv, sichereDatenbank, SICHERUNGEN } from "./archiv";

const neu = () => {
  const db = new Database(":memory:");
  migrieren(db);
  return db;
};

describe("Aufräumen und Archiv", () => {
  it("unveränderte Abrufe erzeugen keinen neuen Schnappschuss, alte Doppelte werden entfernt", () => {
    const db = neu();
    const s = { pid: 1, name: "A", skills: { sprint: { wert: 9 } } };
    speichereKader(db, [s], "q", "2026-10-24T08:00:00Z");
    speichereKader(db, [s], "q", "2026-10-25T08:00:00Z");
    expect((db.prepare("SELECT count(*) n FROM spieler_snapshot").get() as { n: number }).n).toBe(1);
    // Doppelte aus der Zeit vor dieser Regel
    db.prepare("INSERT INTO spieler_snapshot (pid, abgerufen, quelle, daten_json) SELECT pid, '2026-10-26T08:00:00Z', quelle, daten_json FROM spieler_snapshot").run();
    expect(aufraeumen(db)).toContain("1 doppelte Schnappschüsse");
    expect((db.prepare("SELECT count(*) n FROM spieler_snapshot").get() as { n: number }).n).toBe(1);
  });

  it("behält je Art nur die neuesten Rohseiten und die letzten Marktsuchen", () => {
    const db = neu();
    for (let i = 0; i < 5; i++) speichereRohseite(db, { art: "tabelle", url: "u", status: 200, htmlRoh: `${i}`, htmlDom: null }, `2026-10-2${i}T00:00:00Z`);
    for (let i = 0; i < 9; i++) speichereMarktSuche(db, { treffer: 0, seiten: 1, spieler: [] });
    aufraeumen(db);
    expect((db.prepare("SELECT count(*) n FROM rohseite").get() as { n: number }).n).toBe(3);
    expect((db.prepare("SELECT count(*) n FROM markt_suche").get() as { n: number }).n).toBe(7);
  });

  it("archiviert die Top-10-Auswertung nur, wenn sie sich geändert hat", () => {
    const db = neu();
    expect(archiviereTop(db, new Date("2026-10-26T08:00:00Z"))).toBe(true);
    expect(archiviereTop(db, new Date("2026-11-02T08:00:00Z"))).toBe(false);
    expect(ladeTopArchiv(db)).toEqual([{ datum: "2026-10-26", spiele: 0 }]);
  });

  it("Sicherung: Datei je Tag, höchstens 8", async () => {
    const ordner = mkdtempSync(join(tmpdir(), "mzc-"));
    const pfad = join(ordner, "mz-coach.db");
    const db = new Database(pfad);
    migrieren(db);
    for (let i = 1; i <= 10; i++) await sichereDatenbank(db, pfad, new Date(`2026-11-${String(i).padStart(2, "0")}T12:00:00Z`));
    const dateien = readdirSync(join(ordner, "sicherung")).sort();
    expect(dateien).toHaveLength(SICHERUNGEN);
    expect(dateien[0]).toBe("mz-coach-2026-11-03.db");
  });
});
