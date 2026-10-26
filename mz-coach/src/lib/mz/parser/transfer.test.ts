import { describe, expect, it } from "vitest";
import { KaderSeiteUnbekannt } from "./kader";
import { endeAlsDatum, parseTransferSuche } from "./transfer";

// Nachbau im Aufbau einer echten Antwort vom 26.10.2026 (Werte und Namen erfunden).
// Prüft nur, dass der Leser diesen Aufbau liest und bei Abweichungen abbricht statt zu raten.
const block = `<div class="playerContainer"><h2><span class="player_name">Test Spieler</span>
<span class="player_id_span">123</span></h2><table><tr><td>Alter: <strong>25</strong></td></tr>
<tr><td>Nationalität: <img src="x"> <span class="nobreak bold">Deutschland</span></td></tr></table>
<table class="player_skills"><tr><td><span class="skill_name"><span>Sprint</span></span></td><td class="skillval">(<span class="maxed">9</span>)</td></tr></table>
<div class="floatRight transfer-control-area"><div style="margin-top: 3px"><div class="box_dark"><table><tr><td colspan=2><table><tr><td>Wert:</td><td><span class="bold">755&nbsp;758 EUR</span></td></tr></table></td></tr>
<tr><td>Verein</td><td><strong><a href="/?p=team&tid=4711">X</a></strong></td></tr>
<tr><td>Angebot endet</td><td><strong>27-10-2026 18:30</strong></td></tr>
<tr><td>Startgebot</td><td title="1 500 000 EUR"><strong>1&nbsp;500&nbsp;000 EUR</strong></td></tr></table></div>
<div class="box_dark"><table><tr><td><table><tr><td width="80">Letztes Gebot:</td><td><strong> 1&nbsp;750&nbsp;000 EUR </strong></td></tr><tr><td><a href="/?p=team&tid=999">Bieter</a><br>(999)</td></tr></table></td></tr></table></div></div></div>`;

describe("Transfermarktsuche (Nachbau)", () => {
  it("liest Treffer, Spieler und Transferkasten", () => {
    const s = parseTransferSuche(JSON.stringify({ totalHits: 1, players: block }));
    expect(s.treffer).toBe(1);
    expect(s.spieler[0]).toMatchObject({
      pid: 123,
      name: "Test Spieler",
      alter: 25,
      nationalitaet: "Deutschland",
      skills: { sprint: { wert: 9, gemaxt: true } },
      markt: { gefordert: 1_500_000, hoechstgebot: 1_750_000, ende: "27-10-2026 18:30", verkaeuferTid: 4711, bieterTid: 999 },
    });
    expect(endeAlsDatum("27-10-2026 18:30")).toBe("2026-10-27T18:30");
  });

  it("bricht ab bei fehlendem Login, fehlendem JSON und fehlendem Transferkasten", () => {
    expect(() => parseTransferSuche("An error occurred: You need to be logged in")).toThrow(KaderSeiteUnbekannt);
    expect(() => parseTransferSuche("<html>")).toThrow(KaderSeiteUnbekannt);
    const ohneKasten = block.replace('transfer-control-area', 'anders');
    expect(() => parseTransferSuche(JSON.stringify({ totalHits: 1, players: ohneKasten }))).toThrow(KaderSeiteUnbekannt);
    expect(parseTransferSuche(JSON.stringify({ totalHits: 0, players: "" })).spieler).toEqual([]);
  });
});
