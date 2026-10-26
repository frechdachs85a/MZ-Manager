import type { StatsSpiel, StatsTeam } from "@/lib/mz/parser/stats";
import { de, formation } from "./gegner";
import { musterRolle, type Rolle } from "./rolle";

// Zeitfenster für Auswertungen je Spielabschnitt (Minuten, einschließlich)
export const ZEITFENSTER: [number, number][] = [[0, 50], [51, 70], [71, 999]];

// Ausführlicher Spielbericht aus der Stats-XML eines Spiels, aus Sicht eines Teams. Alle Werte stammen
// aus der XML; abgeleitet wird nur, was sich daraus rechnen lässt (2. Halbzeit = Endwert minus 1. Halbzeit,
// Quoten aus den Zählern). Noten oder Bewertungen gibt die XML nicht her, daher gibt es keine.

const n = (v?: string) => {
  if (v === undefined || v === "") return undefined;
  const x = Number(v.replace(",", "."));
  return Number.isFinite(x) ? x : undefined;
};

export type Quote = { wert: number; von: number } | undefined; // wert = Anteil 0..1, von = Anzahl der Versuche
const quote = (treffer?: number, versuche?: number): Quote =>
  treffer !== undefined && versuche ? { wert: treffer / versuche, von: versuche } : undefined;

export type SpielerWert = {
  id: number;
  name: string;
  nr?: number;
  torwart: boolean;
  start: boolean; // in der Startelf (hat eine Startposition)
  rolle?: Rolle; // aus der Startposition (Vorgabe vom 25.10.2026), nur Startelf
  rein?: number; // Minute der Einwechslung
  raus?: number; // Minute der Auswechslung
  tore: number;
  vorlagen: number;
  schuesseTor: number;
  schuesseDaneben: number;
  paesse: number; // goodPasses
  paesseVerloren: number; // interceptedPasses + oobPasses
  passquote: Quote;
  zweikaempfe: Quote; // tacklesWon / (tacklesWon + tacklesLost)
  ballgewinne: number; // interceptions
  paraden: number;
  karten: string[];
};

export type TeamWerte = {
  tore?: number;
  ballbesitz?: number;
  schuesseTor?: number;
  schuesseDaneben?: number;
  paesse?: number;
  passquote: Quote;
  zweikaempfe: Quote;
  paraden?: number;
  ecken?: number;
  freistoesse?: number;
};

export type Halbzeit = { eigen: TeamWerte; gegner: TeamWerte };

export type SpielBericht = {
  mid: number;
  datum?: string;
  eigen: StatsTeam;
  gegner: StatsTeam;
  ergebnis: "S" | "U" | "N";
  endstand: { eigen?: number; gegner?: number };
  halbzeiten: [Halbzeit, Halbzeit] | null; // null, wenn HalfStatistics fehlt
  spieler: SpielerWert[]; // eigenes Team, Startelf zuerst
  gegnerSpieler: SpielerWert[];
  fakten: string[];
};

const ZAEHLER = ["goals", "shotsOnGoal", "shotsWide", "goodPasses", "interceptedPasses", "oobPasses", "tacklesWon", "tacklesLost", "saves", "corners", "freekicks", "possessionTicks"] as const;

function werte(st: Record<string, string | undefined>): TeamWerte {
  const good = n(st.goodPasses);
  const verloren = (n(st.interceptedPasses) ?? 0) + (n(st.oobPasses) ?? 0);
  const won = n(st.tacklesWon);
  const lost = n(st.tacklesLost);
  return {
    tore: n(st.goals),
    ballbesitz: n(st.possession),
    schuesseTor: n(st.shotsOnGoal),
    schuesseDaneben: n(st.shotsWide),
    paesse: good,
    passquote: good !== undefined ? quote(good, good + verloren) : undefined,
    zweikaempfe: won !== undefined && lost !== undefined ? quote(won, won + lost) : undefined,
    paraden: n(st.saves),
    ecken: n(st.corners),
    freistoesse: n(st.freekicks),
  };
}

// 2. Halbzeit: Endwert minus 1. Halbzeit; Ballbesitz aus possessionTicks beider Teams
function zweiteHalbzeit(t: StatsTeam): Record<string, string | undefined> {
  const r: Record<string, string | undefined> = {};
  for (const k of ZAEHLER) {
    const a = n(t.statistik[k]);
    const b = n(t.halbzeit[k]);
    r[k] = a !== undefined && b !== undefined ? String(a - b) : undefined;
  }
  return r;
}

function besitzAusTicks(a?: string, b?: string): [number | undefined, number | undefined] {
  const x = n(a);
  const y = n(b);
  if (x === undefined || y === undefined || x + y <= 0) return [undefined, undefined];
  const p = Math.round((x / (x + y)) * 100);
  return [p, 100 - p];
}

// Kartenarten laut mz-wissen.md: yellow, second yellow. Unbekannte Werte unverändert.
const KARTE: Record<string, string> = { yellow: "Gelb", "second yellow": "Gelb-Rot", red: "Rot" };

const prozent = (q: Quote) => (q ? `${Math.round(q.wert * 100)} %` : "n. v.");

function spielerWerte(s: StatsSpiel, teamId: number): SpielerWert[] {
  const vorlagen = new Map<number, number>();
  const tore = new Map<number, number>();
  for (const t of s.tore) {
    if (t.teamId !== teamId) continue;
    tore.set(t.schuetze, (tore.get(t.schuetze) ?? 0) + 1);
    if (t.vorlage) vorlagen.set(t.vorlage, (vorlagen.get(t.vorlage) ?? 0) + 1);
  }
  return s.spieler
    .filter((p) => p.teamId === teamId)
    .map((p) => {
      const st = p.statistik;
      const good = n(st.goodPasses) ?? 0;
      const verloren = (n(st.interceptedPasses) ?? 0) + (n(st.oobPasses) ?? 0);
      const won = n(st.tacklesWon) ?? 0;
      const lost = n(st.tacklesLost) ?? 0;
      const rein = s.wechsel.find((w) => w.rein === p.id);
      const raus = s.wechsel.find((w) => w.raus === p.id);
      return {
        id: p.id,
        name: p.name,
        nr: p.nr,
        torwart: p.torwart,
        start: !!p.origin,
        rolle: p.editor ? musterRolle(p.editor, p.torwart) : undefined,
        rein: rein?.minute,
        raus: raus?.minute,
        // Tore aus den Goal-Ereignissen (dort steht auch das Team, für das gezählt wurde)
        tore: tore.get(p.id) ?? 0,
        vorlagen: vorlagen.get(p.id) ?? 0,
        schuesseTor: n(st.shotsOnGoal) ?? 0,
        schuesseDaneben: n(st.shotsWide) ?? 0,
        paesse: good,
        paesseVerloren: verloren,
        passquote: quote(good, good + verloren),
        zweikaempfe: quote(won, won + lost),
        ballgewinne: n(st.interceptions) ?? 0,
        paraden: n(st.saves) ?? 0,
        karten: s.karten.filter((k) => k.spieler === p.id).map((k) => `${KARTE[k.art] ?? k.art} ${k.minute}.`),
      };
    })
    // nur wer gespielt hat: Startelf oder eingewechselt
    .filter((p) => p.start || p.rein !== undefined)
    .sort((a, b) => Number(b.start) - Number(a.start) || Number(b.torwart) - Number(a.torwart) || (a.rein ?? 0) - (b.rein ?? 0));
}

// Spielbericht aus der Stats-XML aus Sicht eines Teams
export function spielBericht(s: StatsSpiel, tid: number): SpielBericht {
  const eigen = s.teams.find((t) => t.id === tid);
  const gegner = s.teams.find((t) => t.id !== tid);
  if (!eigen || !gegner) throw new Error(`Team ${tid} spielt nicht in Spiel ${s.mid}.`);
  const we = werte(eigen.statistik);
  const wg = werte(gegner.statistik);
  const ergebnis = (we.tore ?? 0) > (wg.tore ?? 0) ? "S" : (we.tore ?? 0) < (wg.tore ?? 0) ? "N" : "U";

  let halbzeiten: SpielBericht["halbzeiten"] = null;
  if (Object.keys(eigen.halbzeit).length && Object.keys(gegner.halbzeit).length) {
    const e1 = werte(eigen.halbzeit);
    const g1 = werte(gegner.halbzeit);
    const e2r = zweiteHalbzeit(eigen);
    const g2r = zweiteHalbzeit(gegner);
    const [be, bg] = besitzAusTicks(e2r.possessionTicks, g2r.possessionTicks);
    halbzeiten = [
      { eigen: e1, gegner: g1 },
      { eigen: { ...werte(e2r), ballbesitz: be }, gegner: { ...werte(g2r), ballbesitz: bg } },
    ];
  }

  const spieler = spielerWerte(s, eigen.id);
  const gegnerSpieler = spielerWerte(s, gegner.id);
  const fakten: string[] = [];
  const stand = (a?: number, b?: number) => `${a ?? "?"}:${b ?? "?"}`;
  fakten.push(
    `${ergebnis === "S" ? "Sieg" : ergebnis === "N" ? "Niederlage" : "Unentschieden"} ${stand(we.tore, wg.tore)} ${eigen.heim ? "zu Hause" : "auswärts"} gegen ${gegner.name}` +
      (halbzeiten ? ` (Halbzeit ${stand(halbzeiten[0].eigen.tore, halbzeiten[0].gegner.tore)}).` : "."),
  );
  fakten.push(
    `Eigene Einstellung ${de(eigen.tactic)}/${de(eigen.playstyle)}/${de(eigen.aggression)}, Gegner ${de(gegner.tactic)}/${de(gegner.playstyle)}/${de(gegner.aggression)}.`,
  );
  if (we.ballbesitz !== undefined) {
    const hz = halbzeiten ? ` (1. Halbzeit ${halbzeiten[0].eigen.ballbesitz ?? "?"} %, 2. Halbzeit ${halbzeiten[1].eigen.ballbesitz ?? "?"} %)` : "";
    fakten.push(`Ballbesitz ${we.ballbesitz} %${hz}.`);
  }
  const chancen = (w: TeamWerte) => (w.schuesseTor ?? 0) + (w.schuesseDaneben ?? 0);
  fakten.push(
    `Schüsse ${chancen(we)} (${we.schuesseTor ?? "?"} aufs Tor) gegen ${chancen(wg)} (${wg.schuesseTor ?? "?"} aufs Tor).` +
      (we.schuesseTor ? ` Verwertung: ${we.tore ?? 0} Tore aus ${we.schuesseTor} Schüssen aufs Tor (${Math.round(((we.tore ?? 0) / we.schuesseTor) * 100)} %).` : ""),
  );
  if (wg.paraden !== undefined && we.paraden !== undefined) fakten.push(`Paraden: Gegner-Torwart ${wg.paraden}, eigener Torwart ${we.paraden}.`);
  fakten.push(`Passquote ${prozent(we.passquote)} (Gegner ${prozent(wg.passquote)}), Zweikampfquote ${prozent(we.zweikaempfe)} (Gegner ${prozent(wg.zweikaempfe)}).`);
  if (halbzeiten) {
    const [h1, h2] = halbzeiten;
    fakten.push(`Tore je Halbzeit: 1. Halbzeit ${stand(h1.eigen.tore, h1.gegner.tore)}, 2. Halbzeit ${stand(h2.eigen.tore, h2.gegner.tore)}.`);
  }
  // Tore nach Zeitfenster (mz-wissen.md, Abschnitt 14: Vergleich mit den Scoutspielen, bis 50., 51. bis 70., ab 71.)
  const fenster = ZEITFENSTER.map(([von, bis]) => {
    const im = s.tore.filter((t) => t.minute >= von && t.minute <= bis);
    return `${von === 0 ? "bis" : `${von}. bis`} ${bis === 999 ? "Ende" : `${bis}.`} ${im.filter((t) => t.teamId === eigen.id).length}:${im.filter((t) => t.teamId === gegner.id).length}`;
  });
  fakten.push(`Tore nach Zeitfenster: ${fenster.join(", ").replace("bis 50.", "bis zur 50.")}.`);
  const feldG = s.spieler.filter((p) => p.teamId === gegner.id && p.editor && !p.torwart).map((p) => p.editor!);
  if (feldG.length) fakten.push(`Formation ${gegner.name} in diesem Spiel: ${formation(feldG).text}.`);
  const schuetzen = spieler.filter((p) => p.tore > 0).sort((a, b) => b.tore - a.tore);
  if (schuetzen.length) fakten.push(`Torschützen: ${schuetzen.map((p) => `${p.name} ${p.tore}`).join(", ")}.`);
  const vorl = spieler.filter((p) => p.vorlagen > 0).sort((a, b) => b.vorlagen - a.vorlagen);
  if (vorl.length) fakten.push(`Vorlagen: ${vorl.map((p) => `${p.name} ${p.vorlagen}`).join(", ")}.`);
  const eigeneWechsel = s.wechsel.filter((w) => w.teamId === eigen.id);
  const eigeneTaktik = s.taktikwechsel.filter((t) => t.teamId === eigen.id);
  fakten.push(
    `${eigeneWechsel.length} eigene Wechsel (${eigeneWechsel.filter((w) => w.grund === "preset").length} durch Regel), ${eigeneTaktik.length} Taktikwechsel ausgelöst.` +
      ` Gegner: ${s.wechsel.filter((w) => w.teamId === gegner.id).length} Wechsel, ${s.taktikwechsel.filter((t) => t.teamId === gegner.id).length} Taktikwechsel.`,
  );
  const karten = s.karten.filter((k) => k.teamId === eigen.id);
  if (karten.length) fakten.push(`Karten: ${karten.map((k) => `${spieler.find((p) => p.id === k.spieler)?.name ?? `id ${k.spieler}`} (${KARTE[k.art] ?? k.art}, ${k.minute}.)`).join(", ")}.`);

  return { mid: s.mid, datum: s.datum, eigen, gegner, ergebnis, endstand: { eigen: we.tore, gegner: wg.tore }, halbzeiten, spieler, gegnerSpieler, fakten };
}

export const quoteText = prozent;
