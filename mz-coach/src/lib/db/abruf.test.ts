import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { abrufBeenden, abrufBeginnen, ladeRohseite, letzteRohseite, letzterAbruf, speichereRohseite } from "./abruf";
import { migrieren } from "./schema";

function frischeDb() {
  const db = new Database(":memory:");
  migrieren(db);
  return db;
}

describe("Rohseiten und Abruf-Protokoll", () => {
  it("speichert Seiten und liefert die neueste je Art", () => {
    const db = frischeDb();
    speichereRohseite(db, { art: "kader", url: "u", status: 200, htmlRoh: "a", htmlDom: "aa" }, "2026-10-24T08:00:00Z");
    const id = speichereRohseite(db, { art: "kader", url: "u", status: 200, htmlRoh: "b", htmlDom: null }, "2026-10-25T08:00:00Z");
    expect(letzteRohseite(db, "kader")).toMatchObject({ id, bytes: 1 });
    expect(ladeRohseite(db, id, "roh")).toEqual({ url: "u", html: "b" });
    expect(ladeRohseite(db, id, "dom")).toBeNull();
    expect(letzteRohseite(db, "spiel")).toBeNull();
  });

  it("protokolliert Beginn und Ende", () => {
    const db = frischeDb();
    const id = abrufBeginnen(db, "kader", "2026-10-24T08:00:00Z");
    expect(letzterAbruf(db, "kader")).toMatchObject({ ok: null });
    abrufBeenden(db, id, false, "Login falsch", "2026-10-24T08:01:00Z");
    expect(letzterAbruf(db, "kader")).toMatchObject({ ok: 0, meldung: "Login falsch" });
  });
});
