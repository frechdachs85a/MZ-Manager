import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { migrieren } from "@/lib/db/schema";
import { gegnerLuecke } from "./gegner-luecke";
import type { StilEintrag } from "./portfolio";

// Erfundene Testdaten: ohne Kader lässt sich keine Elf besetzen, daher prüft der Test nur die Auswahlregel
const stil = (schluessel: string, quote: number, spiele: number, imArchiv: string[] = []): StilEintrag =>
  ({ schluessel, quote, spiele, S: 0, U: 0, N: 0, bewaehrt: spiele >= 3 && quote >= 0.6, teams: [], haerte: [], imArchiv, beispiel: {} }) as unknown as StilEintrag;

describe("Portfolio-Lücke gegen den nächsten Gegner", () => {
  const db = new Database(":memory:");
  migrieren(db);
  it("keine Lücke, wenn dein bewährter Stil mindestens so gut ist", () => {
    expect(gegnerLuecke(db, "enge Mitte", [stil("3-4-3 shortpass/normal", 0.7, 10), stil("4-4-2 shortpass/normal", 0.8, 5, ["kupass"])])).toBeNull();
  });
  it("keine Lücke ohne Gegnerklasse oder ohne fehlenden bewährten Stil", () => {
    expect(gegnerLuecke(db, undefined, [stil("3-4-3 shortpass/normal", 0.9, 10)])).toBeNull();
    expect(gegnerLuecke(db, "enge Mitte", [stil("3-4-3 shortpass/normal", 0.9, 2)])).toBeNull();
  });
});
