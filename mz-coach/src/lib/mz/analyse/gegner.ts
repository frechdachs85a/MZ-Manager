import type { Punkt } from "@/lib/mz/koordinaten";
import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { AUSSEN_X_LINKS, AUSSEN_X_RECHTS, istAussen, STURM_Y } from "@/lib/mz/taktik/pruefer";

// Gegneranalyse über die Ligaspiele der laufenden Saison (Auftrag, Funktion 3; mz-wissen.md, Abschnitt 10).
// Alles hier beruht auf den Stats-XML. Wo eine Regel aus mz-wissen.md keine genaue Grenze hat,
// steht die verwendete Auslegung als Konstante mit Begründung.

// Abwehr ab Editor-y 215: ManagerZone führt Spieler von Sydney FC bei y 215 (aus origin umgerechnet) als „Vert.“,
// bei y 190 als „Mi.“ (Spielbericht 25.10.2026, Bild von Marcus vom 26.10.2026). Laut mz-wissen.md, Abschnitt 4,
// zählt y 212 im Editor als Mittelfeld. y 213 und 214 sind nicht belegt: solche Spieler zählen als Mittelfeld
// und die Formation wird als nicht eindeutig gekennzeichnet. (Früher hier 222; das war zu streng.)
export const ABWEHR_Y = 215;
export const MITTEL_BELEGT_BIS = 212;

// Zwei Aufstellungen gelten als gleich, wenn jeder Feldspieler höchstens so weit vom passenden Platz
// entfernt steht. Gemessen: Wiederholte Aufstellungen wichen höchstens 1 Punkt ab (Umrechnung auf
// 1 Punkt genau, mz-wissen.md, Abschnitt 3). Mit 2 bleibt Spielraum für Rundung.
export const GLEICH_TOLERANZ = 2;

// "Enge Mitte" (Arbeitsdefinition von Marcus, 25.10.2026): oberhalb der Abwehr steht niemand außen,
// außen = x <= 40 oder x >= 170 (istAussen). Grenze unscharf. Fünferkette ist ein eigener Auslöser.

// unklar: Spieler zwischen belegtem Mittelfeld (212) und belegter Abwehr (215), hier im Mittelfeld gezählt
// unklarSturm: Spieler bei y 111 (laut mz-wissen.md 110 Sturm, 112 Mittelfeld; 111 nicht belegt), im Mittelfeld gezählt
export type Formation = { abwehr: number; mittel: number; sturm: number; unklar: number; unklarSturm: number; text: string };

export type SpielAuswertung = {
  mid: number;
  datum?: string;
  heim: boolean;
  gegner: string;
  tore: { eigen: number; gegner: number };
  tactic: string;
  playstyle: string;
  aggression: string;
  formation: Formation;
  feld: { name: string; p: Punkt }[]; // Startelf ohne Torwart, Editor-Koordinaten
  torwart?: Punkt;
  mittelfeldX?: { min: number; max: number }; // x-Spanne aller Spieler oberhalb der Abwehr
  engeMitte: boolean;
  bank: number;
  bankTorwart: boolean;
  wechsel: { clock: string; minute: number; stand: string; rein: string; raus: string; grund: string; regelMinute?: number }[];
  taktikwechsel: { clock: string; stand: string; art: string; neu: string }[];
  tore_liste: { clock: string; stand: string; eigen: boolean; schuetze: string; vorlage?: string }[];
  karten: { clock: string; spieler: string; art: string }[];
  statistik: Record<string, string>;
};

export function formation(feld: Punkt[]): Formation {
  const abwehr = feld.filter((p) => p.y >= ABWEHR_Y).length;
  const sturm = feld.filter((p) => p.y <= STURM_Y).length;
  const mittel = feld.length - abwehr - sturm;
  const unklar = feld.filter((p) => p.y > MITTEL_BELEGT_BIS && p.y < ABWEHR_Y).length;
  const unklarSturm = feld.filter((p) => p.y > STURM_Y && p.y < STURM_Y + 2).length;
  const text = `${abwehr}-${mittel}-${sturm}`;
  const oder = unklar || unklarSturm ? ` oder ${abwehr + unklar}-${mittel - unklar - unklarSturm}-${sturm + unklarSturm}` : "";
  return { abwehr, mittel, sturm, unklar, unklarSturm, text: text + oder };
}

// Enge Mitte aus den Feldspieler-Positionen (siehe oben)
export function engeMitteAus(feld: Punkt[]): { engeMitte: boolean; mittelfeldX?: { min: number; max: number } } {
  const mittel = feld.filter((p) => p.y < ABWEHR_Y).map((p) => p.x);
  return { engeMitte: mittel.length > 0 && !mittel.some(istAussen), mittelfeldX: mittel.length ? { min: Math.min(...mittel), max: Math.max(...mittel) } : undefined };
}

export function werteSpielAus(s: StatsSpiel, tid: number): SpielAuswertung {
  const team = s.teams.find((t) => t.id === tid);
  const gegner = s.teams.find((t) => t.id !== tid);
  if (!team || !gegner) throw new Error(`Team ${tid} spielt nicht in Spiel ${s.mid}.`);
  const name = new Map(s.spieler.map((p) => [p.id, p.name]));
  const eigene = s.spieler.filter((p) => p.teamId === tid);
  const feld = eigene.filter((p) => p.editor && !p.torwart).map((p) => ({ name: p.name, p: p.editor! }));
  const { engeMitte, mittelfeldX } = engeMitteAus(feld.map((f) => f.p));
  return {
    mid: s.mid,
    datum: s.datum,
    heim: team.heim,
    gegner: gegner.name,
    tore: { eigen: Number(team.statistik.goals ?? NaN), gegner: Number(gegner.statistik.goals ?? NaN) },
    tactic: team.tactic,
    playstyle: team.playstyle,
    aggression: team.aggression,
    formation: formation(feld.map((f) => f.p)),
    feld,
    torwart: eigene.find((p) => p.torwart && p.editor)?.editor,
    mittelfeldX,
    engeMitte,
    bank: eigene.filter((p) => !p.origin).length,
    bankTorwart: eigene.some((p) => !p.origin && p.torwart),
    wechsel: s.wechsel
      .filter((w) => w.teamId === tid)
      .map((w) => ({ clock: w.clock, minute: w.minute, stand: w.stand, rein: name.get(w.rein) ?? `${w.rein}`, raus: name.get(w.raus) ?? `${w.raus}`, grund: w.grund, regelMinute: w.regelMinute })),
    taktikwechsel: s.taktikwechsel.filter((t) => t.teamId === tid).map((t) => ({ clock: t.clock, stand: t.stand, art: t.art, neu: t.neu })),
    tore_liste: s.tore.map((t) => ({
      clock: t.clock,
      stand: t.stand,
      eigen: t.teamId === tid,
      schuetze: name.get(t.schuetze) ?? `${t.schuetze}`,
      vorlage: t.vorlage ? name.get(t.vorlage) : undefined,
    })),
    karten: s.karten.filter((k) => k.teamId === tid).map((k) => ({ clock: k.clock, spieler: name.get(k.spieler) ?? `${k.spieler}`, art: k.art })),
    statistik: team.statistik,
  };
}

// Bestmögliche Zuordnung zweier gleich großer Punktmengen (Ungarische Methode), minimiert die
// größte Einzelabweichung über alle Zuordnungen mit minimaler Summe. Rückgabe: größte Abweichung.
export function abweichung(a: Punkt[], b: Punkt[]): number {
  if (a.length !== b.length || a.length === 0) return Infinity;
  const n = a.length;
  const kosten = a.map((p) => b.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
  // Ungarische Methode (O(n^3)) auf Summenkosten
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const weg = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const benutzt = new Array(n + 1).fill(false);
    do {
      benutzt[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (benutzt[j]) continue;
        const cur = kosten[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          weg[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (benutzt[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = weg[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  let max = 0;
  for (let j = 1; j <= n; j++) max = Math.max(max, kosten[p[j] - 1][j - 1]);
  return max;
}

export type Vergleich = { gleich: boolean; unterschiede: string[]; maxAbweichung: number };

export function vergleiche(a: SpielAuswertung, b: SpielAuswertung): Vergleich {
  const unterschiede: string[] = [];
  if (a.formation.text !== b.formation.text) unterschiede.push(`Formation ${a.formation.text} statt ${b.formation.text}`);
  if (a.tactic !== b.tactic) unterschiede.push(`Taktik ${de(a.tactic)} statt ${de(b.tactic)}`);
  if (a.playstyle !== b.playstyle) unterschiede.push(`Spielweise ${de(a.playstyle)} statt ${de(b.playstyle)}`);
  if (a.aggression !== b.aggression) unterschiede.push(`Härte ${de(a.aggression)} statt ${de(b.aggression)}`);
  const maxAbweichung = abweichung(a.feld.map((f) => f.p), b.feld.map((f) => f.p));
  if (maxAbweichung > GLEICH_TOLERANZ) unterschiede.push(`Aufstellung weicht bis ${maxAbweichung.toFixed(0)} Punkte ab`);
  return { gleich: unterschiede.length === 0, unterschiede, maxAbweichung };
}

export type GegnerAnalyse = {
  tid: number;
  spiele: SpielAuswertung[]; // neuestes zuerst
  urteil: "immer_gleich" | "wechselnd" | "duenn";
  urteilText: string;
  begruendung: { mid: number; text: string }[]; // je Spiel, verglichen mit dem neuesten
  konstant: string[];
  empfehlung: { taktik: "außenR" | "kupass"; regel: string; gruende: string[]; vorbehalte: string[] };
  bilanz: { siege: number; remis: number; niederlagen: number; tore: number; gegentore: number };
};

const DE: Record<string, string> = {
  shortpass: "Kurzpass",
  wings: "Flügel",
  longball: "lange Bälle",
  offensive: "offensiv",
  normal: "normal",
  defensive: "defensiv",
  aggressive: "aggressiv",
  passive: "passiv",
};
export const de = (v: string) => DE[v] ?? v;
// "3-4-3 shortpass/normal/aggressive" -> "3-4-3 Kurzpass/normal/aggressiv" (Formation bleibt, Einstellungen deutsch)
export const stilDe = (s: string) => s.replace(/[A-Za-z]+/g, (w) => DE[w] ?? w);

export function analysiereGegner(tid: number, spiele: StatsSpiel[]): GegnerAnalyse {
  const ausw = spiele.map((s) => werteSpielAus(s, tid)).sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""));
  const neu = ausw[0];
  const begruendung = ausw.slice(1).map((s) => {
    const v = vergleiche(s, neu);
    return { mid: s.mid, text: v.gleich ? `gleich wie das neueste Spiel (größte Abweichung ${v.maxAbweichung.toFixed(0)})` : `anders als das neueste Spiel: ${v.unterschiede.join(", ")}` };
  });
  const alleGleich = ausw.length >= 2 && begruendung.every((b) => b.text.startsWith("gleich"));
  // In Folge gleiche neueste Spiele
  let serie = 1;
  for (const s of ausw.slice(1)) {
    if (vergleiche(s, neu).gleich) serie++;
    else break;
  }
  const urteil: GegnerAnalyse["urteil"] = ausw.length < 2 ? "duenn" : alleGleich ? "immer_gleich" : "wechselnd";
  const formationen = [...new Set(ausw.map((s) => s.formation.text))];
  const urteilText =
    urteil === "duenn"
      ? `Nur ${ausw.length} Ligaspiel mit Stats-XML: Datenlage dünn.`
      : urteil === "immer_gleich"
        ? `Spielt in allen ${ausw.length} Ligaspielen gleich (${neu.formation.text}, ${de(neu.tactic)}/${de(neu.playstyle)}/${de(neu.aggression)}).`
        : `Spielt wechselnd: ${formationen.length} Formationen (${formationen.join(", ")}) in ${ausw.length} Ligaspielen.` +
          (serie > 1 ? ` Die letzten ${serie} Spiele waren gleich.` : "");

  // Was in allen Spielen gleich war
  const konstant: string[] = [];
  for (const [feld, label] of [["tactic", "Taktik"], ["playstyle", "Spielweise"], ["aggression", "Härte"]] as const) {
    const werte = new Set(ausw.map((s) => s[feld]));
    if (werte.size === 1) konstant.push(`${label} immer ${de(ausw[0][feld])}`);
  }
  if (ausw.every((s) => s.wechsel.length === 0)) konstant.push("in keinem Spiel ein Wechsel");
  if (ausw.every((s) => s.taktikwechsel.length === 0)) konstant.push("kein Taktikwechsel ausgelöst (nicht ausgelöste Regeln stehen nicht in der XML)");
  if (ausw.every((s) => !s.bankTorwart)) konstant.push("nie ein Ersatztorwart auf der Bank");

  // Empfehlung nach Abschnitt 10: Fünferkette oder enge Mitte -> kupass, sonst außenR
  const fuenferkette = neu.formation.abwehr >= 5;
  const gruende: string[] = [];
  const vorbehalte: string[] = [];
  let regel: string;
  if (urteil === "immer_gleich") {
    regel = "Spielt nachweislich immer gleich: Taktik darf gezielt angepasst werden (Abschnitt 10). Grundlage:";
  } else {
    regel = urteil === "duenn" ? "Datenlage dünn: Standard-Taktik wählen, nicht anpassen (Abschnitt 10)." : "Spielt wechselnd: Standard-Taktik wählen, nicht anpassen (Abschnitt 10).";
  }
  if (fuenferkette) gruende.push(`Fünferkette im neuesten Spiel (${neu.formation.text}).`);
  if (neu.engeMitte && neu.mittelfeldX) {
    gruende.push(
      `Enge Mitte im neuesten Spiel: alle Spieler oberhalb der Abwehr zwischen x ${neu.mittelfeldX.min} und ${neu.mittelfeldX.max}, niemand außen (x ≤ ${AUSSEN_X_LINKS} oder ≥ ${AUSSEN_X_RECHTS}).`,
    );
  }
  const engAnzahl = ausw.filter((s) => s.engeMitte).length;
  if (ausw.length > 1) gruende.push(`Enge Mitte in ${engAnzahl} von ${ausw.length} Ligaspielen.`);
  const taktik = fuenferkette || neu.engeMitte ? "kupass" : "außenR";
  if (taktik === "außenR") gruende.push("Weder Fünferkette noch enge Mitte im neuesten Spiel.");
  if (neu.formation.unklar && !fuenferkette && neu.formation.abwehr + neu.formation.unklar >= 5) {
    vorbehalte.push(
      `Fünferkette nicht eindeutig: ${neu.formation.unklar} Spieler stehen bei Editor-y 213 bis 214, zwischen belegtem Mittelfeld (212) und belegter Abwehr (215). Zählt ManagerZone sie zur Abwehr, wäre es ${neu.formation.abwehr + neu.formation.unklar}er-Kette und kupass angezeigt.`,
    );
  }
  const andere = ausw.filter((s) => s.formation.text !== neu.formation.text);
  if (andere.length) {
    const auchEng = andere.every((s) => s.engeMitte === neu.engeMitte && (s.formation.abwehr >= 5) === fuenferkette);
    vorbehalte.push(
      `In ${andere.length} von ${ausw.length} Spielen andere Formation (${[...new Set(andere.map((s) => s.formation.text))].join(", ")}). Er kann heute anders aufstellen` +
        (auchEng ? ", der Auslöser für die Empfehlung galt aber auch dort." : "; dort hätte die Regel anders entschieden."),
    );
  }
  vorbehalte.push("Kaderwert-Vergleich fehlt (Abschnitt 10): Kaderseite des Gegners mit Marktwerten nötig.");
  if (!fuenferkette) vorbehalte.push(`Grenze für „außen“ (x ≤ ${AUSSEN_X_LINKS} oder ≥ ${AUSSEN_X_RECHTS}) ist laut Marcus unscharf.`);

  const bilanz = { siege: 0, remis: 0, niederlagen: 0, tore: 0, gegentore: 0 };
  for (const s of ausw) {
    bilanz.tore += s.tore.eigen;
    bilanz.gegentore += s.tore.gegner;
    if (s.tore.eigen > s.tore.gegner) bilanz.siege++;
    else if (s.tore.eigen < s.tore.gegner) bilanz.niederlagen++;
    else bilanz.remis++;
  }

  return { tid, spiele: ausw, urteil, urteilText, begruendung, konstant, empfehlung: { taktik, regel, gruende, vorbehalte }, bilanz };
}

