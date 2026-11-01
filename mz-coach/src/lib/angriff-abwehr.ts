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
export const angriffsArtVon = (tactic?: string) => ART[tactic ?? ""] ?? tactic ?? "?";
export const angriffsArt = (s: Stil) => angriffsArtVon(s.tactic);
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

export const topSpiele = (db: Database.Database) => topAuswertung(db).teams.flatMap((t) => [...t.liga.spiele, ...t.weltliga.spiele]);
export function angriffAbwehrGetrennt(db: Database.Database) {
  return getrennt(topSpiele(db));
}

// Mindestzahl Spiele je Zelle, damit eine Zelle zählt (eigene Setzung; darunter entscheidet der Zufall zu viel)
export const MIN_SPIELE_ZELLE = 8;
export const ketteName = (n: number) => (n >= 5 ? "Fünferkette" : n === 4 ? "Viererkette" : `${n}er-Kette`);

export type DatenWahl = {
  angriff: { art: string; tore: number; spiele: number };
  abwehr: { kette: string; gegentore: number; spiele: number };
  text: string[];
};

// Datengeführte Wahl (Marcus, 01.11.2026: „die Werte von den Top-Teams sind federführend“): Angriffsstil mit den meisten
// Toren gegen seine Kette, eigene Kette mit den wenigsten Gegentoren gegen seinen Angriff, je Zelle mindestens
// MIN_SPIELE_ZELLE Spiele.
export function datenWahl(g: ReturnType<typeof getrennt>, seineKette: string, seinAngriffArt: string): DatenWahl | null {
  const a = g.angriff
    .filter((z) => z.schluessel.endsWith(` gegen ${seineKette}`) && z.spiele >= MIN_SPIELE_ZELLE)
    .sort((x, y) => y.tore - x.tore);
  const b = g.abwehr
    .filter((z) => z.schluessel.endsWith(` gegen ${seinAngriffArt}`) && z.spiele >= MIN_SPIELE_ZELLE)
    .sort((x, y) => x.gegentore - y.gegentore);
  if (!a.length || !b.length) return null;
  const komma = (n: number) => n.toFixed(2).replace(".", ",");
  const art = a[0].schluessel.replace(` gegen ${seineKette}`, "");
  const kette = b[0].schluessel.replace(` gegen ${seinAngriffArt}`, "");
  return {
    angriff: { art, tore: a[0].tore, spiele: a[0].spiele },
    abwehr: { kette, gegentore: b[0].gegentore, spiele: b[0].spiele },
    text: [
      `Angriff gegen seine ${seineKette} (Top 10): ${a.map((z) => `${z.schluessel.replace(` gegen ${seineKette}`, "")} ${komma(z.tore)} Tore (${z.spiele} Spiele)`).join(", ")} → ${art}.`,
      `Abwehr gegen seinen Angriff ${seinAngriffArt} (Top 10): ${b.map((z) => `${z.schluessel.replace(` gegen ${seinAngriffArt}`, "")} ${komma(z.gegentore)} Gegentore (${z.spiele} Spiele)`).join(", ")} → ${kette}.`,
    ],
  };
}

// Gegen welche Formation spielten die Topteams was (Marcus, 01.11.2026: „genau gucken, gegen welchen Gegner die Top-Teams
// welche Taktik gespielt haben; Abwehr, Sturm und Mittelfeld beachten“): Schlüssel des Gegners = Abwehr-Mittelfeld-Sturm
// seiner Startaufstellung plus Angriff über außen/eng; je Topteam-Antwort Formation und Einstellung (Taktik/Spielweise).
export const formationKurz = (s: Stil) => `${s.formation.abwehr}-${s.formation.mittel}-${s.formation.sturm}`;
export const gegnerSchluessel = (s: Stil) => `${formationKurz(s)} ${seinAngriff(s)}`;
export const antwortSchluessel = (s: Stil) => `${formationKurz(s)} ${angriffsArt(s)}/${s.playstyle ?? "?"}`;

export function gegenFormation(spiele: SpielMuster[]) {
  const m = new Map<string, SpielMuster[]>();
  for (const s of spiele) m.set(gegnerSchluessel(s.gegner), [...(m.get(gegnerSchluessel(s.gegner)) ?? []), s]);
  return [...m.entries()]
    .map(([gegner, sp]) => ({ gegner, spiele: sp.length, antworten: tabelle(sp, (s) => antwortSchluessel(s.eigen)).sort((a, b) => b.spiele - a.spiele) }))
    .sort((a, b) => b.spiele - a.spiele);
}
