import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import { ladeEditorReiter, ladeTaktiken, speichereTaktikXml } from "@/lib/db/taktik";
import { migrieren } from "@/lib/db/schema";

vi.mock("server-only", () => ({}));
const { reiterSpeichern } = await import("./editor-reiter");

// Erfundene Taktik (keine echten Daten)
const xml = (pid: number) =>
  [
    `<?xml version="1.0" ?>`,
    `<SoccerTactics>`,
    `\t<Team tactics="wings" playstyle="normal" aggression="normal" captain="${pid}" />`,
    `\t<Pos pos="goalie" pid="${pid}" x="103" y="315" x1="103" y1="315" x2="103" y2="315" pt="1" fk="1" />`,
    ...Array.from({ length: 10 }, (_, i) => `\t<Pos pos="normal" pid="${pid + i + 1}" x="${20 + i * 15}" y="200" x1="${20 + i * 15}" y1="200" x2="${20 + i * 15}" y2="200" pt="1" fk="1" />`),
    `</SoccerTactics>`,
  ].join("\n");

describe("Reiter aus dem Editor speichern", () => {
  it("übernimmt XML und Altersregler, ersetzt Groß/Klein-Doppel, lässt Liga und leere Reiter weg", () => {
    const db = new Database(":memory:");
    migrieren(db);
    speichereTaktikXml(db, "Kupass", xml(500), "von Hand");
    const m = reiterSpeichern(db, [
      { slot: "c", name: "kupass", alterVon: 16, alterBis: 38, spieler: 16, xml: xml(100) },
      { slot: "f", name: "U18", alterVon: 16, alterBis: 18, spieler: 16, xml: xml(200) },
      { slot: "g", name: "Liga", alterVon: 16, alterBis: 38, spieler: 16, xml: xml(300) },
      { slot: "i", name: "I", alterVon: 16, alterBis: 38, spieler: 0 },
    ]);
    expect(m).toContain("2 Reiter gelesen");
    expect(ladeTaktiken(db).map((t) => t.reiter)).toEqual(["U18", "kupass"]);
    expect(ladeEditorReiter(db)?.reiter.find((r) => r.name === "U18")).toMatchObject({ alterVon: 16, alterBis: 18 });
  });
});
