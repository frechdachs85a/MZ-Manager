import type Database from "better-sqlite3";
import { ladeKader } from "@/lib/db/kader";
import { ALTER_FREI, istAltersreiter, ladeEditorReiter, ladeTaktiken } from "@/lib/db/taktik";
import { heuteInBerlin } from "@/lib/format";
import { mzWert, type Position } from "@/lib/mz/formel";
import { rolle } from "@/lib/mz/analyse/markt";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { verfuegbar, zuordnen } from "@/lib/mz/taktik/erzeugen";
import { parseTaktikXml } from "@/lib/mz/taktik/xml";
import { ausdauerPlan, MAX_WECHSEL_SPIEL } from "@/lib/skill-bilanz";
import { naechsterLigaspieltag } from "@/lib/wissen/startbasis";

// Täglicher Taktik-Check (Marcus, 30.10.2026): Skills ändern sich (Bälle dazu, ältere Spieler verlieren Ausdauer oder
// Sprint). Für jede Taktik im Archiv: Plätze bleiben, Besetzung neu nach MZ-Wert der Rolle des Platzes (mz-wissen.md,
// Abschnitt 6) aus Elf, Bank und allen aufstellbaren Spielern, für die ganze Elf auf einmal (ungarische Methode).
// Eigene Setzungen, keine MZ-Regel:
// - BONUS_JETZT: der bisherige Spieler auf einem Platz bekommt einen kleinen Vorsprung, damit nicht wegen Kleinstunterschieden
//   umgestellt wird.
// - MIN_GEWINN: Umstellungen nur vorschlagen, wenn die Elf insgesamt mindestens so viel MZ-Wert gewinnt; nicht aufstellbare
//   Spieler werden immer ersetzt.
// - Ausdauer unter 8 ohne Zeitwechsel: Wechselregel in der WECHSEL_MINUTE mit dem besten Bankspieler für die Rolle,
//   höchstens bis 3 Zeitwechsel insgesamt (niedrigste Ausdauer zuerst); wer leer ausgeht, wird als Schwachstelle gemeldet.
// Vorschlag nur; übernommen wird erst, wenn Marcus es anklickt (abruf/liga.ts, taktikUebernehmen).
// Altersreiter (Altersregler im Editor, z. B. U18 = 16 bis 18; Marcus 31.10.2026): nur Spieler in diesem Alter. Spieler mit
// Rückennummer 100 bis 150 gehören dort aufs Feld, damit sie Spielpraxis bekommen (PRIO_BONUS sorgt dafür, dass sie vor allen
// anderen gewählt werden; der Platz innerhalb der Elf richtet sich weiter nach dem MZ-Wert).
export const PRIO_NR = { von: 100, bis: 150 };
export const PRIO_BONUS = 100;
export type AlterGrenze = { von: number; bis: number };
const istPrio = (s: SpielerDaten) => s.nr !== undefined && s.nr >= PRIO_NR.von && s.nr <= PRIO_NR.bis;
export const BONUS_JETZT = 0.05;
export const MIN_GEWINN = 0.2;
export const WECHSEL_MINUTE = 70;

export type PlatzAenderung = { rolle: Position; x: number; y: number; alt: string; altWert?: number; neu: string; neuWert: number; grund?: string };
export type TaktikCheck = {
  reiter: string;
  ok: boolean; // keine Änderung nötig
  aenderungen: PlatzAenderung[];
  wechselregeln: string[];
  gewinn: number; // Summe MZ-Wert der Elf neu minus alt (kann bei erzwungenem Ersatz auch negativ sein)
  xml: string; // angepasste XML (gleich der alten, wenn ok)
  fehler?: string;
};

const wertIn = (s: SpielerDaten | undefined, r: Position) => {
  if (!s) return undefined;
  const w = mzWert(s.skills, r);
  return w.ok ? w.wert : undefined;
};
const kurz = (s?: SpielerDaten, pid?: number) => (s ? s.name.split(" ").at(-1)! : `pid ${pid}`);
const komma = (n: number) => n.toFixed(2).replace(".", ",");

// pid-Attribute in Pos/Sub und Spieler in Regeln (out_player, in_player_id) tauschen: a <-> b
function tausche(xml: string, a: number, b: number): string {
  const A = `__A${a}__`;
  return xml
    .replace(new RegExp(`(\\s(?:pid|out_player|in_player_id|captain)=")${a}(")`, "g"), `$1${A}$2`)
    .replace(new RegExp(`(\\s(?:pid|out_player|in_player_id|captain)=")${b}(")`, "g"), `$1${a}$2`)
    .replace(new RegExp(A, "g"), String(b));
}

// Prüft eine Taktik gegen den aktuellen Kader und schlägt die angepasste XML vor
export function pruefeTaktikGegenKader(reiter: string, xml: string, kader: SpielerDaten[], spieltag: Date, alter?: AlterGrenze): TaktikCheck {
  const t = parseTaktikXml(xml);
  const nachPid = new Map(kader.map((s) => [s.pid, s]));
  const imAlter = (s: SpielerDaten) => !alter || (s.alter !== undefined && s.alter >= alter.von && s.alter <= alter.bis);
  const ja = verfuegbar(kader, spieltag).ja.filter(imAlter);
  const verfuegbarPids = new Set(ja.map((s) => s.pid));
  const plaetze = t.pos.map((p) => ({ pid: p.pid, x: p.start.x, y: p.start.y, rolle: rolle({ pid: p.pid, x: p.start.x, y: p.start.y, torwart: p.pos === "goalie" }) }));
  // Kandidaten: aufstellbar und mit bekannten Skills
  const kandidaten = ja.filter((s) => plaetze.some((p) => wertIn(s, p.rolle) !== undefined));
  if (kandidaten.length < plaetze.length) return { reiter, ok: true, aenderungen: [], wechselregeln: [], gewinn: 0, xml, fehler: "Zu wenige aufstellbare Spieler mit bekannten Skills." };
  const prio = (s: SpielerDaten) => (alter && istPrio(s) ? PRIO_BONUS : 0);
  const kosten = plaetze.map((p) => kandidaten.map((s) => -((wertIn(s, p.rolle) ?? -100) + (s.pid === p.pid ? BONUS_JETZT : 0) + prio(s))));
  const zu = zuordnen(kosten);
  const neu = plaetze.map((p, i) => kandidaten[zu[i]]);
  // Gewinn mit den echten MZ-Werten vorher (auch nicht aufstellbare Spieler zählen mit ihrem Wert)
  const altSumme = plaetze.reduce((n, p) => n + (wertIn(nachPid.get(p.pid), p.rolle) ?? 0), 0);
  const neuSumme = plaetze.reduce((n, p, i) => n + (wertIn(neu[i], p.rolle) ?? 0), 0);
  const gewinn = Math.round((neuSumme - altSumme) * 100) / 100;
  // Erzwungen: ein Spieler ist nicht aufstellbar (oder zu alt/jung) oder ein Spieler mit Vorrang fehlt in der Elf
  const fehltPrio = alter ? neu.filter((s) => istPrio(s) && !plaetze.some((p) => p.pid === s.pid)) : [];
  const erzwungen = plaetze.some((p) => !verfuegbarPids.has(p.pid)) || fehltPrio.length > 0;

  const aenderungen: PlatzAenderung[] = [];
  let out = xml;
  const umstellen = erzwungen || gewinn >= MIN_GEWINN;
  if (umstellen) {
    const altSet = new Set(plaetze.map((p) => p.pid));
    const neuSet = new Set(neu.map((s) => s.pid));
    const gehen = plaetze.map((p) => p.pid).filter((pid) => !neuSet.has(pid));
    const kommen = neu.map((s) => s.pid).filter((pid) => !altSet.has(pid));
    // 1. Wer neu in die Elf kommt, tauscht mit einem, der geht (Bank und Regeln bleiben stimmig)
    gehen.forEach((g, i) => {
      if (kommen[i] !== undefined) out = tausche(out, g, kommen[i]);
    });
    // 2. Innerhalb der Elf die Plätze nach der Zuordnung setzen (nur die Pos-Zeilen, in Reihenfolge)
    let n = -1;
    out = out.replace(/<Pos\b[^>]*\/?>/g, (zeile) => {
      n++;
      return zeile.replace(/(\spid=")\d+(")/, `$1${neu[n].pid}$2`);
    });
    plaetze.forEach((p, i) => {
      if (neu[i].pid === p.pid) return;
      const alt = nachPid.get(p.pid);
      aenderungen.push({
        rolle: p.rolle,
        x: p.x,
        y: p.y,
        alt: kurz(alt, p.pid),
        altWert: wertIn(alt, p.rolle),
        neu: kurz(neu[i]),
        neuWert: wertIn(neu[i], p.rolle) ?? 0,
        grund: verfuegbarPids.has(p.pid)
          ? istPrio(neu[i]) && fehltPrio.includes(neu[i])
            ? `Nr. ${neu[i].nr} soll Spielpraxis bekommen`
            : undefined
          : alt && !imAlter(alt)
            ? `nicht im Alter ${alter!.von} bis ${alter!.bis}`
            : "nicht aufstellbar",
      });
    });
  }

  // Ausdauer: Startspieler unter der Grenze ohne Zeitwechsel bekommen eine Wechselregel mit dem besten Bankspieler
  const tNeu = parseTaktikXml(out);
  const wechselregeln: string[] = [];
  const zeitRaus = new Set(tNeu.regeln.filter((r) => r.check_time === "true" && /^\d+$/.test(r.out_player ?? "")).map((r) => Number(r.out_player)));
  const bankFrei = tNeu.subs.filter((b) => b.pos === "sub").map((b) => nachPid.get(b.pid)).filter((s): s is SpielerDaten => !!s && verfuegbarPids.has(s.pid));
  const neueRegeln: string[] = [];
  // Höchstens 3 Wechsel: vorhandene feste Zeitwechsel zählen mit; wer keinen Platz mehr bekommt, wird gemeldet
  const kandidatenAusdauer = tNeu.pos
    .filter((x) => x.pos === "normal" && !zeitRaus.has(x.pid))
    .map((x) => ({ pid: x.pid, x: x.start.x, y: x.start.y, ausdauer: nachPid.get(x.pid)?.skills.ausdauer?.wert }));
  // Altersreiter: eine Aufstellung für alles ohne viel Aufwand (Marcus, 31.10.2026), daher keine Ausdauer-Wechsel
  const plan = alter ? { wechseln: [], ohneWechsel: [] } : ausdauerPlan(kandidatenAusdauer, MAX_WECHSEL_SPIEL - zeitRaus.size);
  for (const p of plan.wechseln) {
    const s = nachPid.get(p.pid)!;
    const r = rolle({ pid: p.pid, x: p.x, y: p.y, torwart: false });
    const ersatz = [...bankFrei].sort((a, b) => (wertIn(b, r) ?? 0) - (wertIn(a, r) ?? 0))[0];
    if (!ersatz) {
      wechselregeln.push(`${kurz(s)} (Ausdauer ${p.ausdauer}): keine passende Bank, Wechsel von Hand planen`);
      continue;
    }
    bankFrei.splice(bankFrei.indexOf(ersatz), 1);
    wechselregeln.push(`${WECHSEL_MINUTE}. ${kurz(ersatz)} für ${kurz(s)} (Ausdauer ${p.ausdauer})`);
    neueRegeln.push(
      `\t<TacticRule name="Taktikregel" check_time="true" time="${WECHSEL_MINUTE}" check_goal_condition="false" goal_condition="tie" goals="1" check_player_event="false" player_event_player_type="anyone" player_event="receives_yellow" out_player="${s.pid}" in_player_id="${ersatz.pid}" tactics="no_change" playstyle="no_change" aggression="no_change" formation="no_change" />`,
    );
  }
  for (const p of plan.ohneWechsel) {
    wechselregeln.push(`${kurz(nachPid.get(p.pid))} (Ausdauer ${p.ausdauer}): kein Wechsel mehr frei (3 von 3) → Schwachstelle, siehe Transfermarkt`);
  }
  if (neueRegeln.length) out = out.replace(/<\/SoccerTactics>/, `${neueRegeln.join("\n")}\n</SoccerTactics>`);

  return { reiter, ok: !aenderungen.length && !neueRegeln.length && !wechselregeln.length, aenderungen, wechselregeln, gewinn: umstellen ? gewinn : 0, xml: out };
}

// Altersgrenze eines Reiters: Altersregler aus dem Editor; ohne Editor-Stand bei Namen U18/U21/U23 bis zu diesem Alter
export function alterGrenze(db: Database.Database, reiter: string): AlterGrenze | undefined {
  const r = ladeEditorReiter(db)?.reiter.find((x) => x.name.toLowerCase() === reiter.toLowerCase());
  if (r) return istAltersreiter(r) ? { von: r.alterVon, bis: r.alterBis } : undefined;
  const u = reiter.match(/^u(18|21|23)\b/i);
  return u ? { von: ALTER_FREI.von, bis: Number(u[1]) } : undefined;
}

// Alle Taktiken im Archiv prüfen (gegen den Kader und die Aufstellbarkeit am nächsten Ligaspieltag)
export function taktikCheck(db: Database.Database): TaktikCheck[] {
  const kader = ladeKader(db);
  const spieltag = naechsterLigaspieltag(heuteInBerlin());
  // Nur Reiter, die es im Editor gibt (sobald der Editor einmal gelesen wurde); „Liga“ schreibt die Seite selbst
  const editor = ladeEditorReiter(db);
  const da = (r: string) => !/^liga$/i.test(r) && (!editor || editor.reiter.some((e) => e.name.toLowerCase() === r.toLowerCase()));
  return ladeTaktiken(db).filter((t) => da(t.reiter)).map((t) => {
    try {
      return pruefeTaktikGegenKader(t.reiter, t.xml, kader, spieltag, alterGrenze(db, t.reiter));
    } catch (e) {
      return { reiter: t.reiter, ok: true, aenderungen: [], wechselregeln: [], gewinn: 0, xml: t.xml, fehler: e instanceof Error ? e.message : String(e) };
    }
  });
}

export const checkKurz = (c: TaktikCheck) => [
  ...c.aenderungen.map((a) => `${a.rolle} x ${a.x}: ${a.alt}${a.altWert !== undefined ? ` ${komma(a.altWert)}` : ""} → ${a.neu} ${komma(a.neuWert)}${a.grund ? ` (${a.alt} ${a.grund})` : ""}`),
  ...c.wechselregeln.map((w) => `Wechsel: ${w}`),
];
