import { describe, expect, it } from "vitest";
import { holeStatsXml } from "./spiele";

const XML = '<?xml version="1.0"?><SoccerStatistics matchId="1"></SoccerStatistics>';
const ohneWarten = { warte: async () => {} };

// Ablauf nachgestellt wie am 25.10.2026 beobachtet (docs/mz-seiten.md)
function server(antworten: { stats: string[]; check: string[] }) {
  const aufrufe: string[] = [];
  return {
    aufrufe,
    holen: async (url: string) => {
      aufrufe.push(url.includes("getMatchFiles") ? "stats" : "check");
      return url.includes("getMatchFiles") ? antworten.stats.shift() ?? "" : antworten.check.shift() ?? "";
    },
  };
}

describe("holeStatsXml", () => {
  it("XML sofort da: keine Prüfung", async () => {
    const s = server({ stats: [XML], check: [] });
    expect(await holeStatsXml(1, { ...ohneWarten, holen: s.holen })).toEqual({ ok: true, xml: XML, checks: 0 });
    expect(s.aufrufe).toEqual(["stats"]);
  });

  it("leer, dann queued mit Fehlermeldung, dann ok, dann XML", async () => {
    const s = server({
      stats: ["", XML],
      check: ['{"response":"queued","content":"Error preparing match!"}', '{"response":"ok","content":"<script>"}'],
    });
    expect(await holeStatsXml(1, { ...ohneWarten, holen: s.holen })).toEqual({ ok: true, xml: XML, checks: 2 });
    expect(s.aufrufe).toEqual(["stats", "check", "check", "stats"]);
  });

  it("blocked: sofort aufhören (Scoutspiel ohne Login)", async () => {
    const s = server({ stats: [""], check: ['{"response":"blocked","content":"You are not allowed to view"}'] });
    expect(await holeStatsXml(1, { ...ohneWarten, holen: s.holen })).toMatchObject({ ok: false, grund: "gesperrt", checks: 1 });
  });

  it("bleibt leer: XML LEER nach den erlaubten Versuchen", async () => {
    const s = server({ stats: ["", ""], check: Array(3).fill('{"response":"queued"}') });
    expect(await holeStatsXml(1, { ...ohneWarten, holen: s.holen, versuche: 3 })).toMatchObject({ ok: false, grund: "leer", checks: 3 });
  });
});
