import { describe, expect, it } from "vitest";
import { eigeneGebote } from "./eigene-gebote";

// Erfundenes Beispiel im Aufbau der Antwort von ajax.php?p=transfer&sub=your-bids
const block = (n: number, pid: number, name: string, gebot: string, bew: string, tid: number, team: string) => `
<tr><td colspan=2 name="yourbids___title_${n}"><table><tr>
<td><a href="/?p=transfer&sub=players&u=${pid}">${name}</a></td>
<td><img src="img/icon_deadline.gif"></td><td>01-02-2030 21:05</td>
<td>Letztes Gebot:</td><td>${gebot} EUR <span>${bew ? `Kosten für die Arbeitsbewilligung: <span>${bew} EUR</span>` : ""}</span></td>
</tr></table></td></tr>
<tr><td><div id="yourbids___body_${n}"><table><tr><td>Mannschaft:</td><td><a href="/?p=team&tid=${tid}">${team}</a></td>
<td>Gebotsgeschichte:</td><td>${gebot} EUR</td></tr></table></div></td></tr>`;
const antwort = JSON.stringify({ content: `<table>${block(0, 11, "Max Muster", "1&nbsp;234&nbsp;567", "99&nbsp;000", 5, "Team A")}${block(1, 22, "Erik Beispiel", "800&nbsp;000", "", 6, "Team B")}</table>` });

describe("Deine Gebote (Gebotsübersicht)", () => {
  it("liest Spieler, Ende, letztes Gebot, Arbeitsbewilligung und Mannschaft", () => {
    expect(eigeneGebote(antwort)).toEqual([
      { pid: 11, name: "Max Muster", ende: "2030-02-01 21:05", letztesGebot: 1234567, arbeitsbewilligung: 99000, tid: 5, team: "Team A" },
      { pid: 22, name: "Erik Beispiel", ende: "2030-02-01 21:05", letztesGebot: 800000, arbeitsbewilligung: undefined, tid: 6, team: "Team B" },
    ]);
  });
});
