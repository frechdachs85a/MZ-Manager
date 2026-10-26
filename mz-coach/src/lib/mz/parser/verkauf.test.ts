import { describe, expect, it } from "vitest";
import { parseVerkaufshistorie } from "./verkauf";

// Nachbau im Aufbau der echten Spielerseite vom 26.10.2026 (Namen und Beträge erfunden)
const zeile = (datum: string, preis: string) =>
  `<tr class="odd"><td width="75"><strong>${datum}</strong></td><td><a href="/?p=team&amp;tid=1">A</a></td><td align="center"><i class="fa fa-arrow-right"></i></td><td><a href="/?p=team&amp;tid=2">B</a></td><td align="right">${preis}</td></tr>`;
const seite = (zeilen: string) =>
  `<div class="baz"><div><div class="win_bg"> <h1 class="win_title">Transfers</h1> </div> <div class="win_back"><table class="hitlist"><thead><tr><td><strong>Datum</strong></td><td><strong>Team/Aktion</strong></td><td></td><td><strong>Team</strong></td><td><strong>Preis (EUR)</strong></td></tr></thead><tbody>${zeilen}</tbody></table></div></div></div>
   <div class="baz"><div><div class="win_bg"><h1 class="win_title">Aufenthalt</h1></div></div></div>`;

describe("Verkaufshistorie", () => {
  it("nimmt den neuesten Verkauf mit Preis", () => {
    const h = seite(zeile("20-09-2022", "-") + zeile("13-05-2023", '<div title="100 SEK">1&nbsp;000&nbsp;000</div>') + zeile("20-11-2025", '<div title="5 USD">1&nbsp;213&nbsp;305</div>'));
    expect(parseVerkaufshistorie(h)).toEqual({ preis: 1_213_305, datum: "2025-11-20", transfers: 3 });
  });
  it("nur Jugend-Zugang: noch nie verkauft", () => {
    expect(parseVerkaufshistorie(seite(zeile("20-09-2022", "-")))).toEqual({ preis: undefined, datum: undefined, transfers: 1 });
  });
  it("ohne Kasten: null", () => {
    expect(parseVerkaufshistorie("<html></html>")).toBeNull();
  });
});
