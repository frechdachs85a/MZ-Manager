import { describe, expect, it } from "vitest";
import { parseSpielliste } from "./spielliste";

// Erfundenes Beispiel im Aufbau des Spielplans seit 01.11.2026: je kommendem Spiel eine Taktikauswahl
// („Wechsel zwischen den Taktiken“) mit verschachtelten dl/dd; vorher wurde dadurch nur das erste Spiel erkannt.
const zeile = (mid: number, art: string, heim: string, gast: string, uxx = false) => `
<dd class="odd${uxx ? " uxx" : ""}">
  <dl class="flex-wrap responsive-show">
    <dd class="flex-grow-1"><dl class="flex-nowrap">
      <dd class="responsive-hide match-time match-reference-type">18:00</dd>
      <dd class="responsive-hide match-reference-text-wrapper flex-grow-0"><span>${art}</span> <a href="#">div1.1</a></dd>
      <dd class="teams-wrapper flex-grow-1"><dl class="flex-nowrap">
        <dd class="home-team-column flex-grow-1"><a href="/?p=team&tid=11"><span class="full-name">${heim}</span></a></dd>
        <dd class="bold score-cell-wrapper textCenter flex-grow-0"><a href="/?p=match&sub=result&mid=${mid}&tid=1" class="score-shown gray">vs</a></dd>
        <dd class="away-team-column flex-grow-1"><a href="/?p=team"><span class="full-name">${gast}</span></a></dd>
      </dl></dd>
    </dl></dd>
    <dd class="set-default-wrapper"></dd><dd class="progress-container"><div class="progress-container"></div><a title="Taktik A">außenR</a></dd>
    <dd class="toggle-placeholder-wrapper textRight">&nbsp;</dd><i id="match-row-toggle-${mid}"></i>
  </dl>
  <dl id="action-panel-${mid}" class="action-panel box_dark"><dd><a title="Taktik A">außenR</a></dd></dl>
</dd>
<dt><div class="make-default-caption">Wechsel zwischen den Taktiken</div></dt>`;
const html = `<input id="tid1" value="1"><dl id="fixtures-results-list"><dd class="group">01-11-2030</dd>${zeile(101, "U21 Liga", "Team A", "Mein Team", true)}<dd class="group">04-11-2030</dd>${zeile(102, "Ligaspiel", "Team B", "Mein Team")}${zeile(103, "Weltliga", "Mein Team", "Team C")}</dl>`;

describe("Spielplan mit Taktikauswahl", () => {
  it("erkennt alle Spiele, nicht nur das erste", () => {
    const l = parseSpielliste(html, 1);
    expect(l.spiele.map((s) => [s.mid, s.datum, s.art])).toEqual([
      [101, "2030-11-01", "U21 Liga"],
      [102, "2030-11-04", "Ligaspiel"],
      [103, "2030-11-04", "Weltliga"],
    ]);
  });
});
