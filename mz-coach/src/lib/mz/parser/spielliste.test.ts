import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KaderSeiteUnbekannt } from "./kader";
import { istSpielliste, ligaspieleDieserSaison, parseSpielliste } from "./spielliste";

// Echte Spielliste von YugiPeeK (tid 97933), gespeichert am 25.10.2026, nur lokal vorhanden.
const DATEI = new URL("./fixtures/spielliste-97933-2026-10-25.html", import.meta.url);
const HTML = existsSync(DATEI) ? readFileSync(DATEI, "utf8") : null;

it("ohne Liste: klare Meldung", () => {
  expect(istSpielliste("<html></html>")).toBe(false);
  expect(() => parseSpielliste("<html></html>")).toThrow(KaderSeiteUnbekannt);
});

describe.skipIf(!HTML)("Echte Spielliste tid 97933", () => {
  const l = parseSpielliste(HTML ?? "");

  it("liest Team und alle 25 Spiele", () => {
    expect(l).toMatchObject({ tid: 97933, teamName: "YugiPeeK ✈", serverzeit: "2026-10-25T07:17:33.000Z" });
    expect(l.spiele).toHaveLength(25);
    expect(l.spiele[0]).toMatchObject({ mid: 1637265680, datum: "2026-10-24", zeit: "22:00", art: "Offizieller Pokal", altersklasse: true });
  });

  it("filtert die 2 Ligaspiele dieser Saison", () => {
    expect(ligaspieleDieserSaison(l)).toEqual([
      expect.objectContaining({ mid: 1625669276, datum: "2026-10-21", wettbewerb: "div1.1", heim: { tid: 97933, name: "YugiPeeK ✈" }, gast: { tid: 97246, name: "Sydney FC" }, tore: { heim: 2, gast: 4 } }),
      expect.objectContaining({ mid: 1625669272, datum: "2026-10-18", heim: { tid: 850456, name: "AKKISLA SPOR" }, tore: { heim: 4, gast: 2 } }),
    ]);
  });

  it("zählt Spielarten wie auf der Seite", () => {
    const n = (art: string) => l.spiele.filter((s) => s.art === art).length;
    expect([n("Ligaspiel"), n("Offizieller Pokal"), n("Freundschaftsspiel"), n("Scoutspiel")]).toEqual([2, 20, 2, 1]);
  });
});

describe("letzte Ligaspiele", () => {
  it("nimmt höchstens 8, die neuesten zuerst, nur Ligaspiele dieser Saison", async () => {
    const { letzteLigaspiele, LIGA_MID_AB } = await import("./spielliste");
    const spiel = (i: number, art = "Ligaspiel") => ({
      mid: LIGA_MID_AB + i,
      datum: `2026-10-${String(i).padStart(2, "0")}`,
      art,
      altersklasse: false,
      heim: { name: "A" },
      gast: { name: "B" },
    });
    const l = [...Array.from({ length: 10 }, (_, i) => spiel(i + 1)), spiel(20, "Freundschaftsspiel"), { ...spiel(21), mid: 5 }];
    const r = letzteLigaspiele(l);
    expect(r).toHaveLength(8);
    expect(r[0].datum).toBe("2026-10-10");
    expect(r.at(-1)!.datum).toBe("2026-10-03");
  });
});

// Nachbau einer Zeile des Spielplans (type=scheduled) mit dem Aufbau der echten Antwort vom 26.10.2026,
// Namen und Nummern ausgedacht: kein Action-Panel, Spielnummer nur im „vs“-Link, eigenes Team ohne tid im Link.
const zeile = (mid: number, zeit: string, art: string, wettbewerb: string, uxx: boolean, gegnerTid: number) => `
<dd class="odd${uxx ? " uxx" : ""}"> <dl class="flex-wrap responsive-show"> <dd class="flex-grow-1">${zeit} - <strong>${art}</strong> </dd> </dl>
<dl class="flex-wrap"> <dd class="responsive-hide match-time match-reference-type">${zeit}</dd>
<dd class="responsive-hide match-reference-text-wrapper flex-grow-0"> <span>${art}</span> <a href="/?p=league&type=senior">${wettbewerb}</a> </dd>
<dd class="teams-wrapper flex-grow-1"> <dl class="flex-nowrap">
<dd class="home-team-column flex-grow-1"> <a href="/?p=team" class="clippable"><strong><span class="full-name">Eigenes Team</span><span class="short-name">EIG</span></strong></a> </dd>
<dd class="bold score-cell-wrapper textCenter flex-grow-0"> <a href="/?p=match&sub=result&mid=${mid}&tid=1" class="score-hidden gray">vs</a> <a href="/?p=match&sub=result&mid=${mid}&tid=1" class="score-shown gray">vs</a> </dd>
<dd class="away-team-column flex-grow-1"> <a href="/?p=team&tid=${gegnerTid}" class="clippable"><span class="full-name">Gegner ${gegnerTid}</span></a> </dd>
</dl> </dd> <dd class="set-default-wrapper"></dd> </dl> </dd>`;
const SPIELPLAN = `<dl id="fixtures-results-list" class="hitlist_dl marker fixtures hide-children"> <dd id="head_to_head_title"></dd> <dt></dt>
<dd class="group"> 28-10-2026 </dd>${zeile(1700000001, "15:00", "U18 Liga", "div2.8", true, 50)}${zeile(1700000002, "18:45", "Ligaspiel", "div1.1", false, 60)}</dl>`;

describe("Spielplan (kommende Spiele)", () => {
  const l = parseSpielliste(SPIELPLAN, 1);

  it("liest Spielnummer aus dem vs-Link und setzt die eigene tid", async () => {
    const { istLigaspiel } = await import("./spielliste");
    expect(l.spiele).toHaveLength(2);
    expect(l.spiele[1]).toMatchObject({ mid: 1700000002, datum: "2026-10-28", zeit: "18:45", art: "Ligaspiel", heim: { tid: 1 }, gast: { tid: 60 }, tore: undefined });
    expect(l.spiele.filter(istLigaspiel).map((s) => s.mid)).toEqual([1700000002]);
  });

  it("Anstoß ist deutsche Zeit (Winterzeit UTC+1, Sommerzeit UTC+2)", async () => {
    const { anstoss } = await import("./spielliste");
    expect(anstoss(l.spiele[1])?.toISOString()).toBe("2026-10-28T17:45:00.000Z");
    expect(anstoss({ ...l.spiele[1], datum: "2026-10-21", zeit: "14:45" })?.toISOString()).toBe("2026-10-21T12:45:00.000Z");
    expect(anstoss({ ...l.spiele[1], zeit: undefined })).toBeUndefined();
  });
});
