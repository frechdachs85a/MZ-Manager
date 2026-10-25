import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStatsXml } from "@/lib/mz/parser/stats";
import { parseTaktikXml } from "@/lib/mz/taktik/xml";
import { eigenerVerlauf, gegnerVerlauf, regelErfuellt } from "./verlauf";

const F = (n: string) => new URL(`../parser/fixtures/${n}`, import.meta.url);
const da = existsSync(F("stats-1625669278.xml")) && existsSync(F("kupass-2026-10-25.xml"));

describe.skipIf(!da)("Spielverlauf mit Taktik-Export (eigenes Spiel 21.10., kupass)", () => {
  const spiel = parseStatsXml(readFileSync(F("stats-1625669278.xml"), "utf8"));
  const taktik = parseTaktikXml(readFileSync(F("kupass-2026-10-25.xml"), "utf8"));

  it("ordnet die drei Regelwechsel exakt den Regeln des Exports zu und setzt den Einwechsler auf den Platz", () => {
    const v = eigenerVerlauf(spiel, taktik, 847159);
    const wechsel = v.phasen.filter((p) => p.text.startsWith("Wechsel"));
    expect(wechsel).toHaveLength(3);
    expect(wechsel.every((w) => w.text.includes("(Regel (ab"))).toBe(true);
    const nachHyuga = wechsel[0].aufstellung.find((p) => p.name === "Balthasar Wiesenberg")!;
    const hyugaStart = v.phasen[0].aufstellung.find((p) => p.name === "Kojiro Hyuga")!;
    expect([nachHyuga.x, nachHyuga.y]).toEqual([hyugaStart.x, hyugaStart.y]);
    expect(nachHyuga.quelle).toBe("abgeleitet");
    expect(v.phasen.at(-1)!.aufstellung).toHaveLength(11);
  });

  it("Rückstandsregeln lösen bei einem 9:0-Sieg nie aus", () => {
    for (const r of taktik.regeln.filter((x) => x.check_goal_condition === "true" && x.goal_condition === "down_by_at_least")) {
      expect(regelErfuellt(r, spiel, 847159)).toBeNull();
    }
  });

  it("Gegner: Einwechsler übernimmt Platz, Formationswechsel nicht erkennbar", () => {
    const v = gegnerVerlauf(spiel, 96721);
    expect(v.hinweise[0]).toContain("nicht erkennbar");
    expect(v.phasen[0].aufstellung).toHaveLength(11);
  });
});
