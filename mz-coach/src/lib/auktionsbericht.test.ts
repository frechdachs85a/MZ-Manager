import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { migrieren } from "@/lib/db/schema";
import { protokolliere, speichereAuftrag, speichereEndstand } from "@/lib/db/gebot";
import { auktionsBericht } from "./auktionsbericht";

// Erfundene Testdaten
function db() {
  const d = new Database(":memory:");
  migrieren(d);
  speichereAuftrag(d, { pid: 1, name: "Max Muster", maximum: 2_000_000, status: "aktiv" } as never, "2026-01-01T10:00:00.000Z");
  protokolliere(d, 1, "Geboten: 1", 1_500_000, "2026-01-01T11:00:00.000Z");
  protokolliere(d, 1, "Geboten: 2", 1_700_000, "2026-01-01T11:01:00.000Z");
  return d;
}

describe("Auktionsbericht", () => {
  it("bekommen: höchstes eigenes Gebot und Maximum", () => {
    const b = auktionsBericht(db(), 1, "Auktion vorbei: du warst zuletzt Höchstbietender (Kauf in ManagerZone prüfen).")!;
    expect(b.titel).toBe("✅ Max Muster bekommen für 1.700.000 EUR");
    expect(b.text).toContain("2 Gebot(e)");
    expect(b.text).toContain("1.700.000 EUR");
    expect(b.text).toContain("2.000.000 EUR");
  });
  it("nicht bekommen", () => {
    expect(auktionsBericht(db(), 1, "Auktion vorbei: ein anderer Verein war zuletzt Höchstbietender.")!.titel).toBe("❌ Max Muster: nicht bekommen");
  });
  it("Endstand aus der Gebotsübersicht hat Vorrang", () => {
    const d = db();
    speichereEndstand(d, [{ pid: 1, letztesGebot: 1_800_000, tid: 99, team: "Team X" }]);
    d.prepare("UPDATE gebot_auftrag SET status = 'beendet'").run();
    speichereEndstand(d, [{ pid: 1, letztesGebot: 1_800_000, tid: 99, team: "Team X" }]);
    const b = auktionsBericht(d, 1, "Auktion vorbei: du warst zuletzt Höchstbietender.")!;
    expect(b.titel).toBe("❌ Max Muster: nicht bekommen");
    expect(b.text).toContain("1.800.000 EUR an Team X");
  });
  it("kein Bericht, wenn du den Auftrag selbst beendet hast", () => {
    expect(auktionsBericht(db(), 1, "Auftrag gelöscht oder beendet.")).toBeNull();
  });
});
