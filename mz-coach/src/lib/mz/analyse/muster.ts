import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { werteSpielAus, type Formation } from "./gegner";
import { rolle } from "./markt";

// Spielmuster der Topteams (Auftrag: Top 10 der Rangliste, je 10 Liga- und 10 Weltligaspiele).
// Alles aus der Stats-XML: Aufstellung, Einstellungen, ausgelöste Wechsel und Taktikwechsel mit
// Minute und Spielstand, Gegner und Ergebnis. Nur ausgelöste Regeln stehen in der XML.

export type Lage = "führt" | "gleich" | "hinten";
export type Ergebnis = "S" | "U" | "N";

export type Stil = {
  formation: Formation;
  tactic?: string;
  playstyle?: string;
  aggression?: string;
  engeMitte: boolean;
  fuenferkette: boolean;
  feld: { x: number; y: number }[]; // Feldspieler-Startpositionen (Editor-Koordinaten)
  torwart?: { x: number; y: number };
};

export type SpielMuster = {
  mid: number;
  datum?: string;
  typ?: string; // type-Attribut der XML (Ligaspiel = 1)
  ergebnis: Ergebnis;
  tore: { eigen: number; gegner: number };
  eigen: Stil;
  gegner: Stil & { name: string; tid: number };
  wechsel: { minute: number; regelMinute?: number; lage: Lage; grund: string; raus: string; rein: string; rolleRaus: string; stand: string }[];
  taktikwechsel: { minute: number; lage: Lage; art: string; neu: string; stand: string }[];
  karten: { minute: number; lage: Lage; art: string; spieler: string; stand: string }[];
  // Alle Änderungen im Spielverlauf in zeitlicher Reihenfolge (Wechsel, Taktikwechsel, Karten)
  ablauf: { minute: number; stand: string; text: string }[];
};

const ART_DE: Record<string, string> = { playstyle: "Spielweise", aggression: "Härte", tactic: "Taktik" };
const GRUND_DE: Record<string, string> = { preset: "Regel", injury: "Verletzung" };

// "2:1" (Heim:Gast) aus Sicht des Teams
export function lageAus(stand: string, heim: boolean): Lage {
  const m = stand.match(/^(\d+):(\d+)$/);
  if (!m) return "gleich";
  const [h, g] = [Number(m[1]), Number(m[2])];
  const d = heim ? h - g : g - h;
  return d > 0 ? "führt" : d < 0 ? "hinten" : "gleich";
}

function stil(s: StatsSpiel, tid: number): Stil {
  const a = werteSpielAus(s, tid);
  const abwehr = a.feld.filter((f) => f.p.y >= 222).length;
  return {
    formation: a.formation,
    tactic: a.tactic,
    playstyle: a.playstyle,
    aggression: a.aggression,
    engeMitte: a.engeMitte,
    fuenferkette: abwehr >= 5,
    feld: a.feld.map((f) => f.p),
    torwart: a.torwart,
  };
}

// anonym: ohne Spielernamen (für die Topteams zählt nur, wann welches Team was und wie spielt);
// Spieler werden dann über ihre Rolle aus der Startposition beschrieben.
export function spielMuster(s: StatsSpiel, tid: number, opt: { anonym?: boolean } = {}): SpielMuster {
  const team = s.teams.find((t) => t.id === tid);
  const geg = s.teams.find((t) => t.id !== tid);
  if (!team || !geg) throw new Error(`Team ${tid} spielt nicht in Spiel ${s.mid}.`);
  const eigen = Number(team.statistik.goals ?? NaN);
  const gegner = Number(geg.statistik.goals ?? NaN);
  const minuteVon = (e: { minute: number }) => e.minute;
  const name = new Map(s.spieler.map((p) => [p.id, p]));
  // Rolle des Ausgewechselten aus seiner Startposition (Arbeitsdefinition aus analyse/markt); war er selbst
  // eingewechselt, hat er keine Startposition.
  const rolleVon = (id: number) => {
    const p = name.get(id);
    if (!p?.editor) return "Einwechselspieler";
    return `${rolle({ pid: id, x: p.editor.x, y: p.editor.y, torwart: p.torwart })} ${p.editor.x}/${p.editor.y}`;
  };
  const wechsel = s.wechsel
    .filter((w) => w.teamId === tid)
    .map((w) => ({
      minute: minuteVon(w),
      regelMinute: w.regelMinute,
      lage: lageAus(w.stand, team.heim),
      grund: w.grund,
      raus: opt.anonym ? "" : name.get(w.raus)?.name ?? `id ${w.raus}`,
      rein: opt.anonym ? "" : name.get(w.rein)?.name ?? `id ${w.rein}`,
      rolleRaus: rolleVon(w.raus),
      stand: w.stand,
    }));
  const taktikwechsel = s.taktikwechsel
    .filter((t) => t.teamId === tid)
    .map((t) => ({ minute: minuteVon(t), lage: lageAus(t.stand, team.heim), art: t.art, neu: t.neu, stand: t.stand }));
  const karten = s.karten
    .filter((k) => k.teamId === tid)
    .map((k) => ({ minute: k.minute, lage: lageAus(k.stand, team.heim), art: k.art, spieler: opt.anonym ? rolleVon(k.spieler) : name.get(k.spieler)?.name ?? `id ${k.spieler}`, stand: k.stand }));
  const ablauf = [
    ...wechsel.map((w) => ({
      minute: w.minute,
      stand: w.stand,
      text: opt.anonym
        ? `Wechsel (${GRUND_DE[w.grund] ?? w.grund}${w.regelMinute !== undefined ? `, Regel ab ${w.regelMinute}.` : ""}): ${w.rolleRaus} ausgewechselt, Einwechsler auf diesen Platz (abgeleitet)`
        : `Wechsel (${GRUND_DE[w.grund] ?? w.grund}${w.regelMinute !== undefined ? `, Regel ab ${w.regelMinute}.` : ""}): ${w.rein} für ${w.raus} (${w.rolleRaus})`,
    })),
    ...taktikwechsel.map((t) => ({ minute: t.minute, stand: t.stand, text: `${ART_DE[t.art] ?? t.art} → ${t.neu}` })),
    ...karten.map((k) => ({ minute: k.minute, stand: k.stand, text: `Karte ${k.art}: ${k.spieler}` })),
  ].sort((a, b) => a.minute - b.minute);
  return {
    mid: s.mid,
    datum: s.datum,
    typ: s.typ,
    ergebnis: eigen > gegner ? "S" : eigen < gegner ? "N" : "U",
    tore: { eigen, gegner },
    eigen: stil(s, tid),
    gegner: { ...stil(s, geg.id), name: geg.name, tid: geg.id },
    wechsel,
    taktikwechsel,
    karten,
    ablauf,
  };
}

const zaehle = <T,>(werte: T[], schluessel: (w: T) => string) => {
  const m = new Map<string, number>();
  for (const w of werte) m.set(schluessel(w), (m.get(schluessel(w)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

export type Bilanz = { S: number; U: number; N: number };
const bilanz = (sp: SpielMuster[]): Bilanz => ({
  S: sp.filter((s) => s.ergebnis === "S").length,
  U: sp.filter((s) => s.ergebnis === "U").length,
  N: sp.filter((s) => s.ergebnis === "N").length,
});

// Stilbezeichnung zum Gruppieren: Formation plus Taktik, Spielweise, Härte
export const stilText = (s: Stil) => `${s.formation.text} ${s.tactic ?? "?"}/${s.playstyle ?? "?"}/${s.aggression ?? "?"}`;
// Grobe Gegnerklasse nach den Faustregeln (mz-wissen.md, Abschnitt 10)
export const gegnerKlasse = (s: Stil) => (s.fuenferkette ? "Fünferkette" : s.engeMitte ? "enge Mitte" : "mit Außenspielern");

export type TeamMuster = {
  spiele: number;
  bilanz: Bilanz;
  startStile: [string, number][];
  wechselMinuten: number[]; // Minuten der Regelwechsel (Grund preset), aufsteigend
  wechselJeSpiel: number;
  wechselNachRolle: { rolle: string; grund: string; anzahl: number; minuten: number[] }[];
  taktikwechsel: { lage: Lage; aenderung: string; anzahl: number; minuten: number[] }[];
  gegenKlasse: { klasse: string; bilanz: Bilanz; stile: [string, number][] }[];
};

export function teamMuster(spiele: SpielMuster[]): TeamMuster {
  const regel = spiele.flatMap((s) => s.wechsel.filter((w) => w.grund === "preset").map((w) => w.minute)).sort((a, b) => a - b);
  const tw = spiele.flatMap((s) => s.taktikwechsel.map((t) => ({ ...t, aenderung: `${t.art} → ${t.neu}` })));
  const gruppen = new Map<string, { lage: Lage; aenderung: string; minuten: number[] }>();
  for (const t of tw) {
    const k = `${t.lage}|${t.aenderung}`;
    const g = gruppen.get(k) ?? { lage: t.lage, aenderung: t.aenderung, minuten: [] };
    g.minuten.push(t.minute);
    gruppen.set(k, g);
  }
  const klassen = [...new Set(spiele.map((s) => gegnerKlasse(s.gegner)))];
  return {
    spiele: spiele.length,
    bilanz: bilanz(spiele),
    startStile: zaehle(spiele, (s) => stilText(s.eigen)),
    wechselMinuten: regel,
    wechselJeSpiel: spiele.length ? spiele.reduce((n, s) => n + s.wechsel.length, 0) / spiele.length : 0,
    wechselNachRolle: (() => {
      const m = new Map<string, { rolle: string; grund: string; minuten: number[] }>();
      for (const w of spiele.flatMap((x) => x.wechsel)) {
        const r = w.rolleRaus.split(" ")[0];
        const k = `${r}|${w.grund}`;
        const g = m.get(k) ?? { rolle: r, grund: GRUND_DE[w.grund] ?? w.grund, minuten: [] };
        g.minuten.push(w.minute);
        m.set(k, g);
      }
      return [...m.values()].map((g) => ({ ...g, anzahl: g.minuten.length, minuten: g.minuten.sort((a, b) => a - b) })).sort((a, b) => b.anzahl - a.anzahl);
    })(),
    taktikwechsel: [...gruppen.values()]
      .map((g) => ({ ...g, anzahl: g.minuten.length, minuten: g.minuten.sort((a, b) => a - b) }))
      .sort((a, b) => b.anzahl - a.anzahl),
    gegenKlasse: klassen.map((klasse) => {
      const sp = spiele.filter((s) => gegnerKlasse(s.gegner) === klasse);
      return { klasse, bilanz: bilanz(sp), stile: zaehle(sp, (s) => stilText(s.eigen)) };
    }),
  };
}

// Über alle Topteams: welcher eigene Stil gegen welche Gegnerklasse wie oft gewonnen hat
export type MatrixZeile = { klasse: string; stil: string; bilanz: Bilanz; spiele: number };
export function stilMatrix(spiele: SpielMuster[]): MatrixZeile[] {
  const m = new Map<string, SpielMuster[]>();
  for (const s of spiele) {
    const k = `${gegnerKlasse(s.gegner)}|${stilText(s.eigen)}`;
    m.set(k, [...(m.get(k) ?? []), s]);
  }
  return [...m.entries()]
    .map(([k, sp]) => {
      const [klasse, stil] = k.split("|");
      return { klasse, stil, bilanz: bilanz(sp), spiele: sp.length };
    })
    .sort((a, b) => a.klasse.localeCompare(b.klasse) || b.spiele - a.spiele);
}

