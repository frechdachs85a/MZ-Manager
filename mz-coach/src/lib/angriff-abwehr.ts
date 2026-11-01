import type Database from "better-sqlite3";
import { ABWEHR_Y } from "@/lib/mz/analyse/gegner";
import type { SpielMuster, Stil } from "@/lib/mz/analyse/muster";
import { topAuswertung } from "@/lib/top-auswertung";

// Angriff und Abwehr getrennt (Marcus, 01.11.2026: „Mein Angriff müsste seine Abwehr angucken und meine Abwehr seinen
// Angriff“). Aus den Top-10-Spielen (Stats-XML, Startaufstellungen beider Teams):
// - Angriff: Tore je Spiel nach deinem Angriffsstil (Einstellung Flügel / Kurzpass / lange Bälle) gegen seine Abwehrkette
//   (Anzahl Spieler ab y ABWEHR_Y in seiner Startaufstellung).
// - Abwehr: Gegentore je Spiel nach deiner Abwehrkette gegen seinen Angriff (über außen = jemand außen vor der Abwehr,
//   sonst eng; gleiche Definition wie „enge Mitte“).
// Nur Startaufstellungen; Wechsel im Spiel bleiben unberücksichtigt. Topteams sind meist stärker als ihre Gegner, die Zahlen
// taugen zum Vergleich der Varianten untereinander, nicht als absolute Erwartung.

const ART: Record<string, string> = { wings: "Flügel", shortpass: "Kurzpass", longball: "lange Bälle" };
export const kette = (s: Stil) => {
  const n = s.feld.filter((p) => p.y >= ABWEHR_Y).length;
  return n >= 5 ? "Fünferkette" : n === 4 ? "Viererkette" : `${n}er-Kette`;
};
export const angriffsArt = (s: Stil) => ART[s.tactic ?? ""] ?? s.tactic ?? "?";
export const seinAngriff = (s: Stil) => (s.engeMitte ? "eng" : "über außen");

export type Zelle = { schluessel: string; spiele: number; tore: number; gegentore: number; zuNull: number; S: number; U: number; N: number };

function tabelle(spiele: SpielMuster[], schluessel: (s: SpielMuster) => string): Zelle[] {
  const m = new Map<string, SpielMuster[]>();
  for (const s of spiele) m.set(schluessel(s), [...(m.get(schluessel(s)) ?? []), s]);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return [...m.entries()]
    .map(([k, sp]) => ({
      schluessel: k,
      spiele: sp.length,
      tore: r2(sp.reduce((n, s) => n + s.tore.eigen, 0) / sp.length),
      gegentore: r2(sp.reduce((n, s) => n + s.tore.gegner, 0) / sp.length),
      zuNull: r2(sp.filter((s) => s.tore.gegner === 0).length / sp.length),
      S: sp.filter((s) => s.ergebnis === "S").length,
      U: sp.filter((s) => s.ergebnis === "U").length,
      N: sp.filter((s) => s.ergebnis === "N").length,
    }))
    .sort((a, b) => a.schluessel.localeCompare(b.schluessel));
}

export function getrennt(spiele: SpielMuster[]) {
  return {
    spiele: spiele.length,
    // Tore je Spiel: dein Angriff gegen seine Abwehr
    angriff: tabelle(spiele, (s) => `${angriffsArt(s.eigen)} gegen ${kette(s.gegner)}`),
    // Gegentore je Spiel: deine Abwehr gegen seinen Angriff
    abwehr: tabelle(spiele, (s) => `${kette(s.eigen)} gegen ${seinAngriff(s.gegner)}`),
    // Gesamtstil gegen seinen Angriff (so wählt die Faustregel heute)
    gesamt: tabelle(spiele, (s) => `${angriffsArt(s.eigen)} + ${kette(s.eigen)} gegen ${seinAngriff(s.gegner)}`),
  };
}

export function angriffAbwehrGetrennt(db: Database.Database) {
  const { teams } = topAuswertung(db);
  return getrennt(teams.flatMap((t) => [...t.liga.spiele, ...t.weltliga.spiele]));
}
