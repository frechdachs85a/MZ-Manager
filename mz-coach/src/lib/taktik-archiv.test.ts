import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStatsXml } from "@/lib/mz/parser/stats";
import { parseTaktikXml } from "@/lib/mz/taktik/xml";
import { taktikZuordnen, type ArchivEintrag } from "./taktik-archiv";

// Echte Daten, nur lokal: kupass-Export und das eigene Spiel vom 21.10.2026 (mit kupass gespielt, ±1 Punkt)
const F = (n: string) => new URL(`./mz/parser/fixtures/${n}`, import.meta.url);
const vorhanden = ["kupass-2026-10-25.xml", "aussenR-2026-10-25.xml", "stats-1625669278.xml"].every((n) => existsSync(F(n)));

describe.skipIf(!vorhanden)("Taktik einem eigenen Spiel zuordnen", () => {
  const eintrag = (reiter: string, datei: string): ArchivEintrag => ({
    reiter,
    gespeichert: "",
    quelle: "test",
    taktik: parseTaktikXml(readFileSync(F(datei), "utf8")),
    pruefung: null,
  });
  it("das Spiel vom 21.10. war kupass, nicht außenR", () => {
    const spiel = parseStatsXml(readFileSync(F("stats-1625669278.xml"), "utf8"));
    const z = taktikZuordnen(spiel, [eintrag("außenR", "aussenR-2026-10-25.xml"), eintrag("kupass", "kupass-2026-10-25.xml")]);
    expect(z?.reiter).toBe("kupass");
    expect(z!.abweichung).toBeLessThanOrEqual(2);
  });
});
