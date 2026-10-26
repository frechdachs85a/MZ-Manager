import type Database from "better-sqlite3";
import { formation } from "@/lib/mz/analyse/gegner";
import { gegnerKlasse, type SpielMuster } from "@/lib/mz/analyse/muster";
import { MAX_STUERMER, MIN_ABSTAND, MIN_Y, STURM_Y } from "@/lib/mz/taktik/pruefer";
import { archivLaden } from "@/lib/taktik-archiv";
import { topAuswertung } from "@/lib/top-auswertung";

// Taktik-Portfolio (Auftrag Marcus, 25.10.2026): Was gewinnt bei den Top 10 gegen welchen Gegnertyp,
// welche dieser Stile hast du schon im Archiv, welche fehlen? Alles aus gespeicherten Spielen der Topteams;
// ein Vorschlag ist eine echte Startaufstellung eines Topteams aus einem gewonnenen Spiel, keine erfundene.
export const MIN_SPIELE = 3; // ab so vielen Spielen gilt ein Stil als belegt
export const MIN_QUOTE = 0.6; // Punktquote (Sieg 1, Remis 0,5) ab der ein Stil als bewährt gilt

type Punkt = { x: number; y: number };

// Schlüssel eines Stils: Formation, Taktik, Spielweise (Härte wird getrennt gezählt)
export const stilSchluessel = (f: string, tactic?: string, playstyle?: string) => `${f} ${tactic ?? "?"}/${playstyle ?? "?"}`;

export type Regelcheck = { stuermer: number; minY: number; minAbstand: number; verstoesse: string[] };

// Kurzprüfung einer Startaufstellung nach mz-wissen.md, Abschnitt 4/5 (Regeln 1 und 2)
export function regelcheck(feld: Punkt[]): Regelcheck {
  const stuermer = feld.filter((p) => p.y <= STURM_Y).length;
  const minY = Math.min(...feld.map((p) => p.y));
  let minAbstand = Infinity;
  for (let i = 0; i < feld.length; i++)
    for (let j = i + 1; j < feld.length; j++) minAbstand = Math.min(minAbstand, Math.hypot(feld[i].x - feld[j].x, feld[i].y - feld[j].y));
  const verstoesse: string[] = [];
  if (stuermer > MAX_STUERMER) verstoesse.push(`${stuermer} Stürmer (erlaubt ${MAX_STUERMER})`);
  if (minY < MIN_Y) verstoesse.push(`vorderster Spieler auf y ${minY} (mindestens ${MIN_Y})`);
  if (minAbstand < MIN_ABSTAND) verstoesse.push(`Abstand ${minAbstand.toFixed(1)} (mindestens ${MIN_ABSTAND})`);
  return { stuermer, minY, minAbstand: Math.round(minAbstand * 10) / 10, verstoesse };
}

export type StilEintrag = {
  schluessel: string;
  spiele: number;
  S: number;
  U: number;
  N: number;
  quote: number;
  bewaehrt: boolean;
  teams: string[];
  haerte: [string, number][];
  imArchiv: string[]; // Reiter mit diesem Stil
  beispiel: { team: string; mid: number; datum?: string; gegner: string; tore: string; feld: Punkt[]; torwart?: Punkt; check: Regelcheck };
};

export type KlassenPortfolio = { klasse: string; spiele: number; stile: StilEintrag[] };

// Portfolio: bewährte Stile je Gegnerklasse
export function portfolioAnalyse(db: Database.Database) {
  const { teams } = topAuswertung(db);
  const alle: (SpielMuster & { team: string })[] = teams.flatMap((t) => [...t.liga.spiele, ...t.weltliga.spiele].map((s) => ({ ...s, team: t.name })));

  // Stile deiner archivierten Taktiken (Startaufstellung und Einstellungen aus dem XML)
  const archiv = archivLaden(db).flatMap((a) => {
    if (!a.taktik) return [];
    const feld = a.taktik.pos.filter((p) => p.pos === "normal").map((p) => p.start);
    return [{ reiter: a.reiter, schluessel: stilSchluessel(formation(feld).text, a.taktik.team.tactics, a.taktik.team.playstyle) }];
  });

  const klassen = new Map<string, Map<string, (SpielMuster & { team: string })[]>>();
  for (const s of alle) {
    const k = gegnerKlasse(s.gegner);
    const st = stilSchluessel(s.eigen.formation.text, s.eigen.tactic, s.eigen.playstyle);
    const m = klassen.get(k) ?? new Map();
    m.set(st, [...(m.get(st) ?? []), s]);
    klassen.set(k, m);
  }

  const ergebnis: KlassenPortfolio[] = [...klassen.entries()].map(([klasse, stile]) => {
    const eintraege: StilEintrag[] = [...stile.entries()].map(([schluessel, sp]) => {
      const S = sp.filter((x) => x.ergebnis === "S").length;
      const U = sp.filter((x) => x.ergebnis === "U").length;
      const N = sp.length - S - U;
      const quote = (S + U * 0.5) / sp.length;
      const neueste = [...sp].sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""));
      const b = neueste.find((x) => x.ergebnis === "S") ?? neueste[0];
      const haerte = new Map<string, number>();
      for (const x of sp) haerte.set(x.eigen.aggression ?? "?", (haerte.get(x.eigen.aggression ?? "?") ?? 0) + 1);
      return {
        schluessel,
        spiele: sp.length,
        S,
        U,
        N,
        quote,
        bewaehrt: sp.length >= MIN_SPIELE && quote >= MIN_QUOTE,
        teams: [...new Set(sp.map((x) => x.team))],
        haerte: [...haerte.entries()].sort((a, c) => c[1] - a[1]),
        imArchiv: archiv.filter((a) => a.schluessel === schluessel).map((a) => a.reiter),
        beispiel: {
          team: b.team,
          mid: b.mid,
          datum: b.datum,
          gegner: b.gegner.name,
          tore: `${b.tore.eigen}:${b.tore.gegner}`,
          feld: b.eigen.feld,
          torwart: b.eigen.torwart,
          check: regelcheck(b.eigen.feld),
        },
      };
    });
    eintraege.sort((a, c) => Number(c.bewaehrt) - Number(a.bewaehrt) || c.quote - a.quote || c.spiele - a.spiele);
    return { klasse, spiele: eintraege.reduce((n, e) => n + e.spiele, 0), stile: eintraege };
  });

  const fehlend = ergebnis.flatMap((k) => k.stile.filter((s) => s.bewaehrt && s.imArchiv.length === 0).map((s) => ({ klasse: k.klasse, ...s })));
  const ungenutzt = archiv.filter((a) => !alle.some((s) => stilSchluessel(s.eigen.formation.text, s.eigen.tactic, s.eigen.playstyle) === a.schluessel));
  return { klassen: ergebnis.sort((a, b) => b.spiele - a.spiele), fehlend, ungenutzt, spiele: alle.length, archiv };
}

// Was die Topteams gegen eine Gegnerklasse spielen (für die Gegnerseite)
export function topGegenKlasse(db: Database.Database, klasse: string): StilEintrag[] {
  return portfolioAnalyse(db).klassen.find((k) => k.klasse === klasse)?.stile ?? [];
}
