import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mzWert } from "@/lib/mz/formel";
import { euro, KaderSeiteUnbekannt, parseKaderSeite, serverzeit } from "./kader";

// Echte Spielertabelle von /?p=players&sub=alt, gespeichert von Marcus am 24.10.2026.
// Liegt nur lokal (nicht im öffentlichen Repo, siehe .gitignore). Fehlt sie, werden diese Tests übersprungen.
const DATEI = new URL("./fixtures/kader-alt-2026-10-24.html", import.meta.url);
const vorhanden = existsSync(DATEI);
const SEITE = vorhanden ? readFileSync(DATEI, "utf8") : "";
const spieler = vorhanden ? parseKaderSeite(SEITE).spieler : [];
const nach = (name: string) => spieler.find((s) => s.name === name)!;

describe.skipIf(!vorhanden)("Kaderübersicht (?p=players&sub=alt)", () => {
  it("liest alle 47 Spieler mit pid, Nr, Alter und Marktwert", () => {
    expect(spieler).toHaveLength(47);
    expect(spieler[0]).toMatchObject({ pid: 225496434, nr: 1, name: "Liu Chao Feng", alter: 29, marktwert: 1084289 });
    expect(spieler.at(-1)).toMatchObject({ pid: 237121180, nr: 207, name: "Lars Ruge", alter: 16, marktwert: 19425 });
  });

  it("liest Skills und Rot (maxed) wie auf der Seite", () => {
    expect(nach("Liu Chao Feng").skills).toEqual({
      sprint: { wert: 7, gemaxt: true },
      ausdauer: { wert: 8, gemaxt: true },
      spieluebersicht: { wert: 8, gemaxt: true },
      passen: { wert: 7, gemaxt: true },
      schuss: { wert: 1, gemaxt: false },
      kopfball: { wert: 3, gemaxt: false },
      torwart: { wert: 10, gemaxt: true },
      technik: { wert: 8, gemaxt: true },
      zweikampf: { wert: 1, gemaxt: false },
      flanken: { wert: 6, gemaxt: true },
      standards: { wert: 2, gemaxt: false },
      erfahrung: { wert: 10 },
      form: { wert: 9 },
    });
  });

  it("passt zu mz-wissen.md, Abschnitt 11", () => {
    const c = nach("Maksymilian Cytrynski").skills;
    expect([c.passen?.wert, c.technik?.wert, c.ausdauer]).toEqual([10, 10, { wert: 7, gemaxt: true }]);
    expect(nach("Bülent Kaupa").skills.sprint?.wert).toBe(6);
    const m = nach("Jun Misugi").skills;
    expect(m.kopfball).toEqual({ wert: 8, gemaxt: false });
    expect(nach("Eiko Scholze").skills.schuss).toEqual({ wert: 8, gemaxt: true });
  });

  it("MZ-Formel ergibt Peschkes Werte aus mz-wissen.md (MF 8,37, VT 8,36)", () => {
    const p = nach("Jakob Peschke").skills;
    const mf = mzWert(p, "MF");
    const vt = mzWert(p, "VT");
    expect(mf.ok && mf.wert).toBeCloseTo(8.37, 2);
    expect(vt.ok && vt.wert).toBeCloseTo(8.36, 2);
  });

  it("bricht ab, wenn die Tabelle fehlt oder Spalten fehlen", () => {
    expect(() => parseKaderSeite("<html><title>Logout - Managerzone</title></html>")).toThrow(KaderSeiteUnbekannt);
    expect(() => parseKaderSeite(SEITE.replace('title="Kopfball"', 'title="Header"'))).toThrow("Kopfball");
  });
});

describe("Hilfsfunktionen", () => {
  it("euro", () => {
    expect(euro("1 084 289 EUR")).toBe(1084289);
    expect(euro("0 EUR")).toBe(0);
    expect(euro("1 084 289 USD")).toBeUndefined();
  });

  it("serverzeit als Berliner Zeit", () => {
    // so im HTML der gespeicherten Seite: 22:48:40 Uhr, Sommerzeit (UTC+2)
    expect(serverzeit("server_time = new Date(2026, 9, 24, 22, 48, 40);")).toBe("2026-10-24T20:48:40.000Z");
    expect(serverzeit("server_time = new Date(2026, 11, 1, 9, 0, 0);")).toBe("2026-12-01T08:00:00.000Z");
    expect(serverzeit("nichts")).toBeUndefined();
  });
});
