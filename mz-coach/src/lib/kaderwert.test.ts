import Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { speichereGegnerKader } from "@/lib/db/gegner-kader";
import { speichereKader } from "@/lib/db/kader";
import { migrieren } from "@/lib/db/schema";
import { speichereSpiel } from "@/lib/db/spiele";
import { parseKaderSeite } from "@/lib/mz/parser/kader";
import { parseStatsXml } from "@/lib/mz/parser/stats";
import { kaderwertVergleich } from "./kaderwert";

const F = (n: string) => new URL(`./mz/parser/fixtures/${n}`, import.meta.url);
const vorhanden = existsSync(F("kader-alt-2026-10-24.html")) && existsSync(F("stats-1625669278.xml"));

describe.skipIf(!vorhanden)("Kaderwert-Vergleich", () => {
  it("summiert die Marktwerte der eigenen Startelf vom 21.10. und meldet fehlenden Gegnerkader", () => {
    const db = new Database(":memory:");
    migrieren(db);
    const kader = parseKaderSeite(readFileSync(F("kader-alt-2026-10-24.html"), "utf8")).spieler;
    speichereKader(db, kader, "test");
    const xml = readFileSync(F("stats-1625669278.xml"), "utf8");
    const spiel = parseStatsXml(xml);
    speichereSpiel(db, spiel, xml);
    const elf = spiel.spieler.filter((p) => p.teamId === 847159 && p.editor).map((p) => p.id);
    const erwartet = elf.reduce((n, pid) => n + (kader.find((s) => s.pid === pid)?.marktwert ?? 0), 0);

    const v = kaderwertVergleich(db, 96721);
    expect(v.eigen?.spieler).toBe(11);
    expect(v.eigen?.mitWert).toBe(11);
    expect(v.eigen?.summe).toBe(erwartet);
    expect(v.gegner).toBeNull();

    // Gegnerkader nur mit 2 Spielern bekannt: die übrigen 9 werden als fehlend gemeldet
    const gegnerElf = spiel.spieler.filter((p) => p.teamId === 96721 && p.editor);
    speichereGegnerKader(db, 96721, gegnerElf.slice(0, 2).map((p) => ({ pid: p.id, name: p.name, alter: 30, wert: 1_000_000, skills: {} })));
    db.prepare("INSERT INTO team_spiel (tid, mid, datum, art, daten_json, stand) VALUES (?, ?, ?, ?, ?, ?)").run(
      96721, spiel.mid, "2026-10-21", "Ligaspiel",
      JSON.stringify({ mid: spiel.mid, datum: "2026-10-21", art: "Ligaspiel", altersklasse: false, heim: { name: "a" }, gast: { name: "b" }, tore: { heim: 0, gast: 9 } }),
      "x",
    );
    const g = kaderwertVergleich(db, 96721).gegner!;
    expect([g.summe, g.mitWert, g.spieler, g.fehlt.length]).toEqual([2_000_000, 2, 11, 9]);
  });
});
