import { parse, type HTMLElement } from "node-html-parser";
import { originZuEditor, type Punkt } from "@/lib/mz/koordinaten";

// Stats-XML eines Spiels (getMatchFiles.php?type=stats). Aufbau am echten Spiel 1625669278 geprüft
// (docs/mz-seiten.md). Abweichend von mz-wissen.md, Abschnitt 2: Goal, Card, Miss und Save hängen
// unter dem jeweiligen Player. Bankspieler haben origin="".

export class StatsXmlFehler extends Error {}

export type StatsTeam = {
  id: number;
  name: string;
  heim: boolean; // visiting="0"
  tactic: string;
  playstyle: string;
  aggression: string;
  manager?: string;
  statistik: Record<string, string>;
  halbzeit: Record<string, string>;
};

export type StatsSpieler = {
  id: number;
  teamId: number;
  name: string;
  nr?: number;
  torwart: boolean; // goalkeeper="1" (auch der Ersatztorwart auf der Bank)
  origin?: Punkt; // Startposition, fehlt bei Bankspielern
  editor?: Punkt; // origin umgerechnet (mz-wissen.md, Abschnitt 3)
  statistik: Record<string, string>;
};

export type Ereignis = { clock: string; minute: number; frame: number; stand: string };
export type Tor = Ereignis & { teamId: number; schuetze: number; vorlage?: number };
export type Wechsel = Ereignis & { teamId: number; rein: number; raus: number; grund: string; regelMinute?: number; attrs: Record<string, string> };
export type TaktikWechsel = Ereignis & { teamId: number; art: string; neu: string };
export type Karte = Ereignis & { spieler: number; teamId: number; art: string };

export type StatsSpiel = {
  mid: number;
  datum?: string;
  ende?: string;
  final: boolean;
  typ?: string;
  teams: [StatsTeam, StatsTeam];
  spieler: StatsSpieler[];
  tore: Tor[];
  wechsel: Wechsel[];
  taktikwechsel: TaktikWechsel[];
  karten: Karte[];
  hinweise: string[];
};

export function istStatsXml(text: string): boolean {
  return /<SoccerStatistics[\s>]/.test(text);
}

// Herausschneiden, falls die XML in einer gespeicherten Webseite oder mit Kopf steckt
export function statsXmlAus(text: string): string {
  const a = text.indexOf("<SoccerStatistics");
  const e = text.lastIndexOf("</SoccerStatistics>");
  if (a < 0 || e < 0) throw new StatsXmlFehler("Keine vollständige <SoccerStatistics>…</SoccerStatistics> gefunden.");
  return text.slice(a, e + "</SoccerStatistics>".length);
}

const zahl = (v: string | undefined) => (v !== undefined && /^-?\d+$/.test(v) ? Number(v) : undefined);

function attrs(el: HTMLElement): Record<string, string> {
  return { ...el.attributes };
}

function punkt(v: string | undefined): Punkt | undefined {
  const m = (v ?? "").match(/^(\d+),(\d+)$/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : undefined;
}

// "60:11.333" -> 60 (volle Minuten der Spieluhr)
function minute(clock: string): number {
  const m = clock.match(/^(\d+):/);
  if (!m) throw new StatsXmlFehler(`Unbekanntes Zeitformat "${clock}".`);
  return Number(m[1]);
}

function kinder(el: HTMLElement, tag: string): HTMLElement[] {
  return el.childNodes.filter((n): n is HTMLElement => (n as HTMLElement).rawTagName === tag);
}

// Alle Nachfahren mit genau diesem Elementnamen (Groß-/Kleinschreibung wie in der XML)
function alle(el: HTMLElement, tag: string): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const n of el.childNodes) {
    const h = n as HTMLElement;
    if (!h.rawTagName) continue;
    if (h.rawTagName === tag) out.push(h);
    out.push(...alle(h, tag));
  }
  return out;
}

export function parseStatsXml(text: string): StatsSpiel {
  const doc = parse(statsXmlAus(text), { lowerCaseTagName: false });
  const root = kinder(doc, "SoccerStatistics")[0];
  if (!root) throw new StatsXmlFehler("<SoccerStatistics> fehlt.");
  const mid = zahl(root.getAttribute("matchId"));
  if (!mid) throw new StatsXmlFehler("matchId fehlt.");
  const hinweise: string[] = [];

  const teamEls = kinder(root, "Team");
  if (teamEls.length !== 2) throw new StatsXmlFehler(`${teamEls.length} statt 2 Teams.`);
  const teams = teamEls.map((t) => {
    const a = attrs(t);
    const stat = kinder(t, "Statistics")[0];
    const halb = kinder(t, "HalfStatistics")[0];
    return {
      id: zahl(a.id)!,
      name: a.name ?? "",
      heim: a.visiting === "0",
      tactic: a.tactic ?? "",
      playstyle: a.playstyle ?? "",
      aggression: a.aggression ?? "",
      manager: kinder(t, "MetaData")[0]?.getAttribute("manager"),
      statistik: stat ? attrs(stat) : {},
      halbzeit: halb ? attrs(halb) : {},
    };
  }) as [StatsTeam, StatsTeam];

  // Spieler und ihre Ereignisse
  type Roh = { art: "tor" | "karte"; el: HTMLElement; spieler: number; teamId: number };
  const roh: Roh[] = [];
  const spieler: StatsSpieler[] = kinder(root, "Player").map((p) => {
    const a = attrs(p);
    const id = zahl(a.id)!;
    const teamId = zahl(a.teamId)!;
    for (const g of kinder(p, "Goal")) roh.push({ art: "tor", el: g, spieler: id, teamId });
    for (const c of kinder(p, "Card")) roh.push({ art: "karte", el: c, spieler: id, teamId });
    const stat = kinder(p, "Statistics")[0];
    return { id, teamId, name: a.name ?? "", nr: zahl(a.shirtno), torwart: a.goalkeeper === "1", origin: punkt(a.origin), statistik: stat ? attrs(stat) : {} };
  });

  // Umrechnung in Editor-Koordinaten je Team über den Torwart der Startelf
  for (const t of teams) {
    const tw = spieler.filter((s) => s.teamId === t.id && s.torwart && s.origin);
    if (tw.length !== 1 || (tw[0].origin!.y !== 0 && tw[0].origin!.y !== 1000)) {
      hinweise.push(`${t.name}: Torwart der Startelf nicht eindeutig bei origin-y 0 oder 1000, keine Umrechnung.`);
      continue;
    }
    const seite = tw[0].origin!.y as 0 | 1000;
    for (const s of spieler.filter((x) => x.teamId === t.id && x.origin)) s.editor = originZuEditor(s.origin!, seite);
  }

  // Alle Ereignisse nach frame sortieren und den Spielstand mitführen
  type Ev = { frame: number; clock: string; mach: (stand: string) => void; tor?: number };
  const evs: Ev[] = [];
  const tore: Tor[] = [];
  const wechsel: Wechsel[] = [];
  const taktikwechsel: TaktikWechsel[] = [];
  const karten: Karte[] = [];
  const basis = (el: HTMLElement) => {
    const clock = el.getAttribute("clock") ?? "";
    return { clock, minute: minute(clock), frame: zahl(el.getAttribute("frame")) ?? 0 };
  };
  for (const r of roh) {
    const b = basis(r.el);
    if (r.art === "tor") {
      const team = zahl(r.el.getAttribute("team")) ?? r.teamId;
      evs.push({ ...b, tor: team, mach: (stand) => tore.push({ ...b, stand, teamId: team, schuetze: r.spieler, vorlage: zahl(r.el.getAttribute("assister")) }) });
    } else {
      evs.push({ ...b, mach: (stand) => karten.push({ ...b, stand, spieler: r.spieler, teamId: r.teamId, art: r.el.getAttribute("type") ?? "" }) });
    }
  }
  // Wechsel und Taktikwechsel stehen unter Events (Tactic im echten Spiel nicht vorhanden, Aufbau aus mz-wissen.md)
  for (const el of alle(root, "Substitution")) {
    const a = attrs(el);
    const b = basis(el);
    evs.push({ ...b, mach: (stand) => wechsel.push({ ...b, stand, teamId: zahl(a.teamId)!, rein: zahl(a.playerId)!, raus: zahl(a.substitutedId)!, grund: a.reason ?? "", regelMinute: zahl(a.minute), attrs: a }) });
  }
  for (const el of alle(root, "Tactic")) {
    const a = attrs(el);
    const zeit = a.clock ?? a.time ?? "";
    const b = { clock: zeit, minute: minute(zeit), frame: zahl(a.frame) ?? 0 };
    evs.push({ ...b, mach: (stand) => taktikwechsel.push({ ...b, stand, teamId: zahl(a.teamId)!, art: a.type ?? "", neu: a.new_setting ?? "" }) });
  }

  const heim = teams.find((t) => t.heim) ?? teams[0];
  const gast = teams.find((t) => t !== heim)!;
  const stand = { [heim.id]: 0, [gast.id]: 0 };
  // Bei gleichem frame zählt das Tor vor anderen Ereignissen
  evs.sort((a, b) => a.frame - b.frame || (b.tor ? 1 : 0) - (a.tor ? 1 : 0));
  for (const e of evs) {
    if (e.tor !== undefined) stand[e.tor] = (stand[e.tor] ?? 0) + 1;
    e.mach(`${stand[heim.id]}:${stand[gast.id]}`);
  }

  // Gegenprobe mit der Team-Statistik
  for (const t of teams) {
    const n = tore.filter((x) => x.teamId === t.id).length;
    const soll = zahl(t.statistik.goals);
    if (soll !== undefined && soll !== n) hinweise.push(`${t.name}: ${n} Tore gelesen, laut Statistik ${soll}.`);
  }
  const final = root.getAttribute("final") === "1";
  if (!final) hinweise.push("Spiel laut XML nicht final (final ≠ 1), Statistik eventuell noch nicht fertig.");

  return {
    mid,
    datum: root.getAttribute("date"),
    ende: root.getAttribute("enddate"),
    final,
    typ: root.getAttribute("type"),
    teams,
    spieler,
    tore,
    wechsel,
    taktikwechsel,
    karten,
    hinweise,
  };
}
