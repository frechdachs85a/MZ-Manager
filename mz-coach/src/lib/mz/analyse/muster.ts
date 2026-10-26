import type { Bedingung, StatsSpiel } from "@/lib/mz/parser/stats";
import { de, werteSpielAus, type Formation } from "./gegner";
import { musterRolle, type Rolle } from "./rolle";

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

// Version des gespeicherten Musters (top_spiel.muster_json). 2: Rollen nach Vorgabe vom 25.10.2026,
// Spielstandbedingung, Torverlauf, Spielstand bei Taktikwechseln aus time.
export const MUSTER_VERSION = 2;

export type MusterWechsel = {
  minute: number; // Spieluhr (clock)
  zeit?: string; // time-Attribut
  regelMinute?: number;
  lage: Lage;
  grund: string; // preset | injury
  bedingung?: Bedingung;
  raus: string;
  rein: string;
  rolleRaus: Rolle | "unbekannt";
  rolleAbgeleitet: boolean; // Ausgewechselter war selbst eingewechselt: Rolle des Spielers, dessen Platz er übernahm
  rausPos?: { x: number; y: number };
  stand: string;
};

export type SpielMuster = {
  version?: number;
  mid: number;
  datum?: string;
  typ?: string; // type-Attribut der XML (Ligaspiel = 1)
  ergebnis: Ergebnis;
  tore: { eigen: number; gegner: number };
  eigen: Stil;
  gegner: Stil & { name: string; tid: number };
  wechsel: MusterWechsel[];
  // minute aus dem time-Attribut (Tactic hat keine Spieluhr)
  taktikwechsel: { minute: number; zeit?: string; lage: Lage; art: string; neu: string; stand: string }[];
  // Tore in zeitlicher Folge (Spieluhr-Minute), eigen = Tor dieses Teams
  torVerlauf?: { minute: number; frame: number; eigen: boolean }[];
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
  return {
    formation: a.formation,
    tactic: a.tactic,
    playstyle: a.playstyle,
    aggression: a.aggression,
    engeMitte: a.engeMitte,
    fuenferkette: a.formation.abwehr >= 5,
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
  const name = new Map(s.spieler.map((p) => [p.id, p]));
  // Rolle des Ausgewechselten aus seiner Startposition. War er selbst eingewechselt, hat er keine Startposition:
  // dann gilt die Rolle des Spielers, dessen Platz er übernommen hat (abgeleitet).
  const geerbt = new Map<number, { rolle: Rolle | "unbekannt"; pos?: { x: number; y: number } }>();
  const rolleVon = (id: number) => {
    const p = name.get(id);
    if (p?.editor) return { rolle: musterRolle(p.editor, p.torwart), pos: p.editor, abgeleitet: false };
    const g = geerbt.get(id);
    return g ? { ...g, abgeleitet: true } : { rolle: "unbekannt" as const, abgeleitet: true };
  };
  const wechsel: MusterWechsel[] = [...s.wechsel]
    .filter((w) => w.teamId === tid)
    .sort((a, b) => a.frame - b.frame)
    .map((w) => {
      const r = rolleVon(w.raus);
      geerbt.set(w.rein, { rolle: r.rolle, pos: r.pos });
      return {
        minute: w.minute,
        zeit: w.zeit,
        regelMinute: w.regelMinute,
        lage: lageAus(w.stand, team.heim),
        grund: w.grund,
        bedingung: w.bedingung,
        raus: opt.anonym ? "" : name.get(w.raus)?.name ?? `id ${w.raus}`,
        rein: opt.anonym ? "" : name.get(w.rein)?.name ?? `id ${w.rein}`,
        rolleRaus: r.rolle,
        rolleAbgeleitet: r.abgeleitet,
        rausPos: r.pos,
        stand: w.stand,
      };
    });
  const taktikwechsel = s.taktikwechsel
    .filter((t) => t.teamId === tid)
    .map((t) => ({ minute: t.minute, zeit: t.zeit, lage: lageAus(t.stand, team.heim), art: t.art, neu: t.neu, stand: t.stand }));
  const karten = s.karten
    .filter((k) => k.teamId === tid)
    .map((k) => ({ minute: k.minute, lage: lageAus(k.stand, team.heim), art: k.art, spieler: opt.anonym ? rolleVon(k.spieler).rolle : name.get(k.spieler)?.name ?? `id ${k.spieler}`, stand: k.stand }));
  const ablauf = [
    ...wechsel.map((w) => ({
      minute: w.minute,
      stand: w.stand,
      text: `Wechsel (${GRUND_DE[w.grund] ?? w.grund}${w.regelMinute !== undefined ? `, Regel ab ${w.regelMinute}.` : ""}${w.bedingung ? `, ${bedingungText(w.bedingung)}` : ""}): ${
        opt.anonym ? "" : `${w.rein} für ${w.raus}, `
      }${w.rolleRaus}${w.rolleAbgeleitet ? " (Rolle abgeleitet)" : ""} raus, Einwechsler übernimmt den Platz (abgeleitet)`,
    })),
    ...taktikwechsel.map((t) => ({ minute: t.minute, stand: t.stand, text: `${ART_DE[t.art] ?? t.art} → ${de(t.neu)}` })),
    ...karten.map((k) => ({ minute: k.minute, stand: k.stand, text: `Karte ${k.art}: ${k.spieler}` })),
  ].sort((a, b) => a.minute - b.minute);
  return {
    version: MUSTER_VERSION,
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
    torVerlauf: s.tore.map((t) => ({ minute: t.minute, frame: t.frame, eigen: t.teamId === tid })),
  };
}

const torWort = (n?: number) => (n === undefined ? "?" : `${n} ${n === 1 ? "Tor" : "Toren"}`);
// scorecondition/score wie goal_condition/goals im Taktik-Export
export function bedingungText(b: Bedingung): string {
  if (b.art === "tie") return "bei Gleichstand";
  if (b.art === "ahead_by_at_least") return `bei mindestens ${torWort(b.tore)} Führung`;
  if (b.art === "down_by_at_least") return `bei mindestens ${torWort(b.tore)} Rückstand`;
  return `Bedingung ${b.art}${b.tore !== undefined ? ` ${b.tore}` : ""}`;
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
        const r = w.rolleRaus;
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


// ---- Regelmuster über alle Spiele eines Teams (Vorgabe Marcus, 25.10.2026) ----
// In der XML stehen nur Regeln, die ausgelöst haben. Lag ein Team zurück und kam keine Änderung, hat es für
// diese Lage sehr wahrscheinlich keine Regel. Sätze nennen immer, aus wie vielen Spielen sie stammen.

export type RegelSatz = { art: "wechsel" | "taktik" | "keine" | "info"; text: string };

const LAGE_DE: Record<Lage, string> = { führt: "bei Führung", gleich: "bei Gleichstand", hinten: "bei Rückstand" };
const ROLLE_SATZ: Record<string, string> = { Mittelfeld: "Mittelfeldspieler", unbekannt: "Spieler unbekannter Rolle" };
const ROLLEN_FOLGE = ["Torwart", "Eckstürmer", "Mittelstürmer", "Mittelfeld", "Außenverteidiger", "Innenverteidiger", "unbekannt"];

const aufzaehlung = (t: string[]) => (t.length <= 1 ? t.join("") : `${t.slice(0, -1).join(", ")} und ${t[t.length - 1]}`);
const minutenText = (m: number[]) => {
  const a = Math.min(...m);
  const b = Math.max(...m);
  return a === b ? `in der ${a}.` : `zwischen der ${a}. und ${b}.`;
};
const spieleText = (k: number, n: number) => (k === n ? (n === 1 ? "im einzigen Spiel" : `immer (${n} von ${n} Spielen)`) : `in ${k} von ${n} Spielen`);

// Lage des Teams zur Spieluhr-Minute (Tore bis einschließlich dieser Minute)
function lageBei(s: SpielMuster, minute: number): Lage | undefined {
  if (!s.torVerlauf) return undefined;
  const t = s.torVerlauf.filter((x) => x.minute < minute);
  const d = t.filter((x) => x.eigen).length - t.filter((x) => !x.eigen).length;
  return d > 0 ? "führt" : d < 0 ? "hinten" : "gleich";
}

// Ab welcher Minute das Team erstmals in dieser Lage war (gleich: ab Anpfiff), undefined = nie oder unbekannt
function erstmals(s: SpielMuster, lage: Lage): number | undefined {
  if (lage === "gleich") return 0;
  if (!s.torVerlauf) return undefined;
  let d = 0;
  for (const t of [...s.torVerlauf].sort((a, b) => a.frame - b.frame)) {
    d += t.eigen ? 1 : -1;
    if ((lage === "führt" && d > 0) || (lage === "hinten" && d < 0)) return t.minute;
  }
  return undefined;
}

function rollenText(jeSpiel: string[][]): string {
  const sortiert = jeSpiel.map((r) => [...r].sort((a, b) => ROLLEN_FOLGE.indexOf(a) - ROLLEN_FOLGE.indexOf(b)));
  const gleich = sortiert.every((r) => r.join("|") === sortiert[0].join("|"));
  const zaehl = (rs: string[]) => {
    const m = new Map<string, number>();
    for (const r of rs) m.set(r, (m.get(r) ?? 0) + 1);
    return [...m.entries()];
  };
  const wort = (r: string) => ROLLE_SATZ[r] ?? r;
  if (gleich) return aufzaehlung(zaehl(sortiert[0]).map(([r, n]) => (n > 1 ? `${n} ${wort(r)}` : wort(r))));
  return `je nach Spiel ${aufzaehlung(zaehl(sortiert.flat()).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${wort(r)} (${n}×)`))}`;
}

export function regelMuster(spiele: SpielMuster[]): RegelSatz[] {
  const n = spiele.length;
  if (!n) return [];
  const saetze: RegelSatz[] = [];

  // Regelwechsel: je Regelminute und Bedingung
  type G = { minute?: number; bedingung?: Bedingung; jeSpiel: Map<number, MusterWechsel[]> };
  const gruppen = new Map<string, G>();
  for (const s of spiele)
    for (const w of s.wechsel.filter((x) => x.grund === "preset")) {
      const k = `${w.regelMinute ?? "?"}|${w.bedingung ? `${w.bedingung.art}:${w.bedingung.tore}` : ""}`;
      const g = gruppen.get(k) ?? { minute: w.regelMinute, bedingung: w.bedingung, jeSpiel: new Map() };
      g.jeSpiel.set(s.mid, [...(g.jeSpiel.get(s.mid) ?? []), w]);
      gruppen.set(k, g);
    }
  for (const g of [...gruppen.values()].sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999))) {
    const ws = [...g.jeSpiel.values()];
    const rollen = rollenText(ws.map((x) => x.map((w) => w.rolleRaus)));
    const abgeleitet = ws.flat().some((w) => w.rolleAbgeleitet) ? " (Rolle teils abgeleitet: Ausgewechselter war selbst eingewechselt)" : "";
    const wann = g.minute !== undefined ? `in der ${g.minute}.` : "(Regelminute fehlt in der XML)";
    let bed: string;
    if (g.bedingung) bed = `, Bedingung laut XML: ${bedingungText(g.bedingung)}`;
    else {
      const lagen = [...new Set(ws.flat().map((w) => w.lage))];
      if (lagen.length > 1) bed = ", unabhängig vom Spielstand";
      else {
        // Nicht ausgelöst, obwohl die Minute erreicht wurde: Spielstand dort war anders -> spricht für eine Bedingung
        const andere = spiele.filter((s) => !g.jeSpiel.has(s.mid)).map((s) => (g.minute !== undefined ? lageBei(s, g.minute) : undefined));
        const hinweis =
          andere.length && andere.every((l) => l !== undefined && l !== lagen[0])
            ? `; in den ${andere.length} anderen Spielen stand es in der ${g.minute}. anders, spricht für eine Spielstandbedingung (abgeleitet)`
            : "";
        bed = `, bisher nur ${LAGE_DE[lagen[0]]} ausgelöst (keine Bedingung in der XML${hinweis})`;
      }
    }
    saetze.push({ art: "wechsel", text: `Wechselt ${wann} ${spieleText(ws.length, n)} ${rollen}${bed}${abgeleitet}.` });
  }
  const verletzt = spiele.flatMap((s) => s.wechsel.filter((w) => w.grund === "injury"));
  if (verletzt.length) saetze.push({ art: "info", text: `${verletzt.length} Wechsel wegen Verletzung (keine Regel), Minuten ${verletzt.map((w) => w.minute).sort((a, b) => a - b).join(", ")}.` });

  // Taktikwechsel: je Lage, Art und neuer Einstellung. Bezug: Spiele, in denen das Team in dieser Lage war.
  const tg = new Map<string, { lage: Lage; art: string; neu: string; minuten: number[]; mids: Set<number> }>();
  for (const s of spiele)
    for (const t of s.taktikwechsel) {
      const k = `${t.lage}|${t.art}|${t.neu}`;
      const g = tg.get(k) ?? { lage: t.lage, art: t.art, neu: t.neu, minuten: [], mids: new Set() };
      g.minuten.push(t.minute);
      g.mids.add(s.mid);
      tg.set(k, g);
    }
  for (const g of [...tg.values()].sort((a, b) => Math.min(...a.minuten) - Math.min(...b.minuten))) {
    const inLage = spiele.filter((s) => erstmals(s, g.lage) !== undefined).length;
    const bezug = g.lage === "gleich" || inLage === 0 ? spieleText(g.mids.size, n) : `in ${g.mids.size} von ${inLage} Spielen mit ${g.lage === "führt" ? "Führung" : "Rückstand"}`;
    // Härte wie in den Beispielen nur mit dem Wert ("auf aggressiv"), bei "normal" mit Art, sonst mehrdeutig
    const was = g.art === "aggression" && g.neu !== "normal" ? de(g.neu) : `${ART_DE[g.art] ?? g.art} ${de(g.neu)}`;
    saetze.push({ art: "taktik", text: `Stellt ${LAGE_DE[g.lage]} ${minutenText(g.minuten)} auf ${was} (${bezug}; Minute laut time-Attribut).` });
  }

  // Keine Regel für eine Lage: Team war in der Lage, aber nichts wurde ausgelöst
  for (const lage of ["hinten", "führt"] as Lage[]) {
    const ab = spiele.map((s) => erstmals(s, lage)).filter((m): m is number => m !== undefined);
    if (!ab.length) continue;
    const wort = lage === "hinten" ? "Rückstand" : "Führung";
    const zeit = `${lage === "hinten" ? "Lag" : "Führte"} in ${ab.length} von ${n} Spielen (erstmals ab der ${ab.sort((a, b) => a - b).join("., ")}.)`;
    if (!spiele.some((s) => s.taktikwechsel.some((t) => t.lage === lage)))
      saetze.push({ art: "keine", text: `${zeit}, nie eine Änderung von Taktik, Spielweise oder Härte bei ${wort}: sehr wahrscheinlich keine ${wort}sregel dafür.` });
    if (!spiele.some((s) => s.wechsel.some((w) => w.grund === "preset" && w.lage === lage)))
      saetze.push({ art: "keine", text: `${zeit}, nie ein Regelwechsel bei ${wort}: sehr wahrscheinlich keine Wechselregel für ${wort}.` });
  }
  if (!spiele.some((s) => s.torVerlauf)) saetze.push({ art: "info", text: "Torverlauf fehlt in den gespeicherten Mustern, Aussagen zu Spielen ohne Auslösung nicht möglich." });
  return saetze;
}
