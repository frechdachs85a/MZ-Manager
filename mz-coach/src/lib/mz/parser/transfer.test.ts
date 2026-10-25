import { describe, expect, it } from "vitest";
import { KaderSeiteUnbekannt } from "./kader";
import { endeAlsDatum, parseTransferSuche } from "./transfer";

// Nachbau nach dem Quelltext von Mazyar (keine echte Antwort, die liegt noch nicht vor).
// Prüft nur, dass der Leser diesen Aufbau liest und bei Abweichungen abbricht statt zu raten.
const block = `<div class="playerContainer"><h2><span class="player_name">Test Spieler</span>
<span class="player_id_span">123</span></h2><table><tr><td>Alter: <strong>25</strong></td></tr>
<tr><td>Nationalität: <img src="x"> <span class="nobreak bold">Deutschland</span></td></tr></table>
<table class="player_skills"><tr><td><span class="skill_name"><span>Sprint</span></span></td><td class="skillval">(<span class="maxed">9</span>)</td></tr></table>
<div class="transfer-control-area"><div>
<div class="box_dark"><table><tr><td>Verein: <a href="https://www.managerzone.com/?p=team&amp;tid=4711">X</a></td></tr><tr><td>b</td></tr><tr><td><strong>27-10-2026 18:30</strong></td></tr><tr><td><strong>1 500 000 EUR</strong></td></tr></table></div>
<div><table><tr><td>x</td></tr><tr><td><strong>1 750 000 EUR</strong></td></tr></table></div>
</div></div></div>`;

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
      markt: { gefordert: 1_500_000, hoechstgebot: 1_750_000, ende: "27-10-2026 18:30", verkaeuferTid: 4711 },
    });
    expect(endeAlsDatum("27-10-2026 18:30")).toBe("2026-10-27T18:30");
  });

  it("bricht ab bei fehlendem Login, fehlendem JSON und fehlendem Transferkasten", () => {
    expect(() => parseTransferSuche("An error occurred: You need to be logged in")).toThrow(KaderSeiteUnbekannt);
    expect(() => parseTransferSuche("<html>")).toThrow(KaderSeiteUnbekannt);
    const ohneKasten = block.replace('class="transfer-control-area"', 'class="anders"');
    expect(() => parseTransferSuche(JSON.stringify({ totalHits: 1, players: ohneKasten }))).toThrow(KaderSeiteUnbekannt);
    expect(parseTransferSuche(JSON.stringify({ totalHits: 0, players: "" })).spieler).toEqual([]);
  });
});
