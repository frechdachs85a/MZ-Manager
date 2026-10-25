import { existsSync, readFileSync } from "node:fs";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
import { parseKaderSeite } from "./kader";
import { parseSpielerBlock } from "./spielerblock";
import { parseSpielerSeite, scoutTextAus } from "./status";

// Echte Spieleransicht und Kaderübersicht vom 24.10.2026, nur lokal (siehe .gitignore).
const SPIELER = new URL("./fixtures/spieler-2026-10-24.html", import.meta.url);
const KADER = new URL("./fixtures/kader-alt-2026-10-24.html", import.meta.url);
const vorhanden = existsSync(SPIELER) && existsSync(KADER);
const bloecke = vorhanden
  ? parse(readFileSync(SPIELER, "utf8")).querySelectorAll("div.playerContainer").map(parseSpielerBlock)
  : [];
const kader = vorhanden ? parseKaderSeite(readFileSync(KADER, "utf8")).spieler : [];

describe.skipIf(!vorhanden)("Spielerblock (div.playerContainer)", () => {
  it("liest alle 47 Blöcke mit denselben Skills, Alter und Wert wie die Kaderübersicht", () => {
    expect(bloecke).toHaveLength(47);
    for (const k of kader) {
      const b = bloecke.find((x) => x.pid === k.pid)!;
      expect(b, k.name).toBeDefined();
      expect(b.name).toBe(k.name);
      expect(b.alter).toBe(k.alter);
      expect(b.wert).toBe(k.marktwert);
      expect(b.skills).toEqual(k.skills);
    }
  });

  it("liest Nationalität, Arbeitsbewilligung und Gehalt", () => {
    const liu = bloecke.find((b) => b.pid === 225496434)!;
    expect(liu).toMatchObject({ nationalitaet: "China", arbeitsbewilligung: { land: "Deutschland", tage: 479 }, gehalt: 13660 });
    expect(bloecke.find((b) => b.name === "Maksymilian Cytrynski")).toMatchObject({ nationalitaet: "Polen" });
    expect(bloecke.find((b) => b.name === "Maksymilian Cytrynski")?.arbeitsbewilligung).toBeUndefined();
    expect(bloecke.filter((b) => b.nationalitaet !== "Deutschland").map((b) => b.name)).toHaveLength(7);
    expect(bloecke.filter((b) => b.arbeitsbewilligung)).toHaveLength(2);
  });
});

describe.skipIf(!existsSync(SPIELER))("Loyale Spieler in der Spieleransicht", () => {
  it("genau die 10 loyalen Spieler haben keinen Scoutbericht", () => {
    const s = parseSpielerSeite(readFileSync(SPIELER, "utf8")).spieler;
    expect(s.filter((x) => x.loyal)).toHaveLength(10);
    expect(s.filter((x) => !x.scout).map((x) => x.pid).sort()).toEqual(s.filter((x) => x.loyal).map((x) => x.pid).sort());
    expect(s.every((x) => x.loyal || x.hatScoutLink)).toBe(true);
    expect(s.map((x) => x.block)).toEqual(s.map((_, i) => `thePlayers_${i}`));
  });
});

describe("Text aus der Scoutbericht-Antwort", () => {
  it("HTML und JSON, Leerraum zusammengefasst", () => {
    expect(scoutTextAus("<div><p>Ein  großartiges&nbsp;Talent.</p><br>Zweite Zeile</div>")).toBe("Ein großartiges Talent.\nZweite Zeile");
    expect(scoutTextAus(JSON.stringify({ html: "<b>Elitespieler</b>" }))).toBe("Elitespieler");
  });
});
