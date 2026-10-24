import { parse, type HTMLElement } from "node-html-parser";
import type { Skill, Skills } from "@/lib/mz/skills";
import type { SpielerDaten } from "@/lib/mz/spieler";

// Liest die eigene Kaderübersicht /?p=players&sub=alt (Tabelle #playerAltViewTable).
// Aufbau an der echten Seite vom 24.10.2026 geprüft (docs/mz-seiten.md, Fixture im Ordner fixtures).
// Spalten werden über ihre Überschrift zugeordnet. Fehlt eine erwartete Spalte, bricht der
// Parser ab, statt Werte falsch zuzuordnen.

export class KaderSeiteUnbekannt extends Error {}

// Überschriften-Titel (deutsche Seite) der Skill-Spalten
export const SKILL_SPALTEN: Record<string, Skill> = {
  Sprint: "sprint",
  Ausdauer: "ausdauer",
  Spielübersicht: "spieluebersicht",
  Passen: "passen",
  Schuss: "schuss",
  Kopfball: "kopfball",
  Torwart: "torwart",
  Technik: "technik",
  Zweikampf: "zweikampf",
  Flanken: "flanken",
  Standards: "standards",
  Erfahrung: "erfahrung",
  Form: "form",
};

// Erfahrung und Form sind nicht trainierbar und tragen auf der Seite nie die Klasse "maxed".
const OHNE_MAXED: Skill[] = ["erfahrung", "form"];

const PFLICHT = ["Nr", "Name", "Wert", "Alter"] as const;

export type KaderSeite = {
  spieler: SpielerDaten[];
  // Serverzeit der Seite (Europe/Berlin), falls im HTML enthalten
  serverzeit?: string;
};

function text(el: HTMLElement | null | undefined): string {
  return (el?.text ?? "").replace(/ /g, " ").trim();
}

function ganzzahl(s: string): number | undefined {
  return /^\d+$/.test(s) ? Number(s) : undefined;
}

// "1 084 289 EUR" (mit geschützten Leerzeichen) -> 1084289. Andere Währungen sind nicht beobachtet.
export function euro(s: string): number | undefined {
  const m = s.replace(/ /g, " ").trim().match(/^([\d ]+) EUR$/);
  return m ? Number(m[1].replace(/ /g, "")) : undefined;
}

// `server_time = new Date(2026, 9, 24, 22, 48, 40);` (Monat ab 0). Die Uhr der Seite zeigte am
// 24.10.2026 dieselbe Zeit wie Europe/Berlin (docs/mz-seiten.md), daher als Berliner Zeit gelesen.
export function serverzeit(html: string): string | undefined {
  const m = html.match(/server_time = new Date\((\d+), (\d+), (\d+), (\d+), (\d+), (\d+)\)/);
  if (!m) return undefined;
  const [j, mo, t, h, mi, s] = m.slice(1).map(Number);
  // Offset von Europe/Berlin zu diesem Zeitpunkt bestimmen
  const alsUtc = Date.UTC(j, mo, t, h, mi, s);
  const teile = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(alsUtc));
  const w = (typ: string) => Number(teile.find((p) => p.type === typ)?.value);
  const berlinAlsUtc = Date.UTC(w("year"), w("month") - 1, w("day"), w("hour"), w("minute"), w("second"));
  return new Date(alsUtc - (berlinAlsUtc - alsUtc)).toISOString();
}

export function parseKaderSeite(html: string): KaderSeite {
  const doc = parse(html);
  const tabelle = doc.querySelector("table#playerAltViewTable");
  if (!tabelle) throw new KaderSeiteUnbekannt("Spielertabelle (#playerAltViewTable) nicht gefunden.");

  const kopf = tabelle.querySelectorAll("thead th");
  const spalte = new Map<string, number>();
  const skillSpalte = new Map<number, Skill>();
  kopf.forEach((th, i) => {
    const a = th.querySelector("a");
    const titel = a?.getAttribute("title");
    if (titel && SKILL_SPALTEN[titel]) skillSpalte.set(i, SKILL_SPALTEN[titel]);
    else if (a) spalte.set(text(a), i);
  });
  for (const p of PFLICHT) {
    if (!spalte.has(p)) throw new KaderSeiteUnbekannt(`Spalte "${p}" fehlt in der Spielertabelle.`);
  }
  const fehlend = Object.keys(SKILL_SPALTEN).filter((t) => ![...skillSpalte.values()].includes(SKILL_SPALTEN[t]));
  if (fehlend.length) throw new KaderSeiteUnbekannt(`Skill-Spalten fehlen: ${fehlend.join(", ")}.`);

  const spieler: SpielerDaten[] = [];
  for (const tr of tabelle.querySelectorAll("tbody tr")) {
    const zellen = tr.querySelectorAll("td");
    if (zellen.length !== kopf.length) {
      throw new KaderSeiteUnbekannt(`Zeile mit ${zellen.length} statt ${kopf.length} Zellen.`);
    }
    const link = zellen[spalte.get("Name")!].querySelector("a");
    const pid = ganzzahl(new URLSearchParams((link?.getAttribute("href") ?? "").split("?")[1] ?? "").get("pid") ?? "");
    const name = text(link);
    if (!pid || !name) throw new KaderSeiteUnbekannt("Zeile ohne Spieler-Link (pid) oder Namen.");

    const skills: Skills = {};
    for (const [i, skill] of skillSpalte) {
      const wert = ganzzahl(text(zellen[i]));
      if (wert === undefined || wert > 10) throw new KaderSeiteUnbekannt(`Ungültiger Skillwert bei ${name}.`);
      const maxed = zellen[i].classList.contains("maxed");
      skills[skill] = OHNE_MAXED.includes(skill) ? { wert } : { wert, gemaxt: maxed };
    }

    const nr = ganzzahl(text(zellen[spalte.get("Nr")!]));
    const alter = ganzzahl(text(zellen[spalte.get("Alter")!]));
    const marktwert = euro(text(zellen[spalte.get("Wert")!]));
    spieler.push({
      pid,
      name,
      ...(nr !== undefined && { nr }),
      ...(alter !== undefined && { alter }),
      ...(marktwert !== undefined && { marktwert }),
      skills,
    });
  }
  if (spieler.length === 0) throw new KaderSeiteUnbekannt("Spielertabelle ist leer.");
  return { spieler, serverzeit: serverzeit(html) };
}
