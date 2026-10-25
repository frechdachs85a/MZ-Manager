import type { HTMLElement } from "node-html-parser";
import type { Skill, Skills } from "@/lib/mz/skills";
import { euro, KaderSeiteUnbekannt, SKILL_SPALTEN } from "./kader";

// Ein Spielerblock (div.playerContainer) wie auf der Spieleransicht ?p=players (geprüft an der
// echten Seite vom 24.10.2026). Laut Quelltext des offenen Userscripts Mazyar liefert die
// Transfermarktsuche dieselben Blöcke; an einer echten Suchantwort ist das noch nicht geprüft.

export type SpielerBlock = {
  pid: number;
  name: string;
  alter?: number;
  nationalitaet?: string;
  // Zeile "Arbeitsbewilligung: <Flagge Land> (n Tage)", nur bei manchen Ausländern vorhanden
  arbeitsbewilligung?: { land: string; tage?: number };
  wert?: number; // EUR
  gehalt?: number; // EUR
  skills: Skills;
};

const OHNE_MAXED: Skill[] = ["erfahrung", "form"];

export function text(el: HTMLElement | null | undefined): string {
  return (el?.text ?? "").replace(/&nbsp;| /g, " ").replace(/\s+/g, " ").trim();
}

// Zelle der Infotabelle, deren Text mit `beschriftung` beginnt
function zelle(block: HTMLElement, beschriftung: RegExp): HTMLElement | undefined {
  return block.querySelectorAll("td").find((td) => beschriftung.test(text(td)));
}

export function parseSpielerBlock(block: HTMLElement): SpielerBlock {
  const pid = Number(text(block.querySelector(".player_id_span")));
  const name = text(block.querySelector(".player_name"));
  if (!pid || !name) throw new KaderSeiteUnbekannt("Spielerblock ohne id oder Namen.");

  const alterTd = zelle(block, /^Alter:/);
  const alter = Number(text(alterTd?.querySelector("strong")));
  const natTd = zelle(block, /^Nationalität:/);
  const nationalitaet = text(natTd?.querySelector("span.bold")) || undefined;
  // Auf der Seite mit drei l geschrieben ("Arbeitsbewillligung")
  const abTd = zelle(block, /^Arbeitsbewil+igung:/);
  let arbeitsbewilligung: SpielerBlock["arbeitsbewilligung"];
  if (abTd) {
    const land = abTd.querySelector("img")?.getAttribute("title") ?? "";
    const tage = text(abTd).match(/\((\d+) Tage\)/);
    if (!land) throw new KaderSeiteUnbekannt(`Arbeitsbewilligung ohne Land bei ${name}.`);
    arbeitsbewilligung = { land, tage: tage ? Number(tage[1]) : undefined };
  }
  const wert = euro(text(zelle(block, /^Wert:/)?.querySelector("span.bold")));
  const gehalt = euro(text(zelle(block, /^Gehalt:/)?.querySelector("span.bold")));

  // Die Skill-Tabelle steht für Desktop und Mobil doppelt, die erste reicht.
  const skills: Skills = {};
  const tabelle = block.querySelector("table.player_skills");
  for (const tr of tabelle?.querySelectorAll("tr") ?? []) {
    const titel = text(tr.querySelector("span.skill_name > span"));
    const wertEl = tr.querySelector("td.skillval > span");
    if (!titel || !wertEl) continue;
    const skill = SKILL_SPALTEN[titel];
    if (!skill) throw new KaderSeiteUnbekannt(`Unbekannter Skill „${titel}“ bei ${name}.`);
    const w = Number(text(wertEl));
    if (!Number.isInteger(w) || w < 0 || w > 10) throw new KaderSeiteUnbekannt(`Skillwert „${text(wertEl)}“ bei ${name}.`);
    skills[skill] = OHNE_MAXED.includes(skill) ? { wert: w } : { wert: w, gemaxt: wertEl.classList.contains("maxed") };
  }

  return {
    pid,
    name,
    alter: Number.isInteger(alter) && alter > 0 ? alter : undefined,
    nationalitaet,
    arbeitsbewilligung,
    wert,
    gehalt,
    skills,
  };
}
