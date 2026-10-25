import type Database from "better-sqlite3";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { ALLE_SKILLS, SKILL_LABEL, type Skill } from "@/lib/mz/skills";

// Scoutbericht-Einstufung (Vorgabe Marcus, 25.10.2026). Rang 1 = beste. Hoch-Sterne zählen mehr als Niedrig-Sterne.
// Ein Rang gilt nur, wenn Sterne und Schlüsselwort im Text zusammenpassen; sonst "Scoutbericht unbekannt",
// nicht raten. Neue Kombinationen kommen erst nach Bestätigung durch Marcus dazu (Tabelle scout_kombi).
export type Kombi = { rang: number; hoch: number; niedrig: number; schluessel: string[]; abzeichen: string; bestaetigt?: string };

export const KOMBIS: Kombi[] = [
  { rang: 1, hoch: 4, niedrig: 2, schluessel: ["erstaunliches Potenzial", "Spieler der Spitzenklasse"], abzeichen: "Spitzenklasse" },
  { rang: 2, hoch: 4, niedrig: 1, schluessel: ["großartiges Talent", "Elitespieler"], abzeichen: "Elite" },
  { rang: 3, hoch: 3, niedrig: 2, schluessel: ["vielseitig", "Spitzenspieler"], abzeichen: "Spitzenspieler" },
  { rang: 4, hoch: 3, niedrig: 1, schluessel: ["vielversprechend", "Schlüsselfähigkeiten"], abzeichen: "Schlüsselfähigkeiten" },
  { rang: 5, hoch: 2, niedrig: 2, schluessel: ["vielseitig, aber keine wirklichen Hauptstärken"], abzeichen: "Keine Hauptstärken" },
  { rang: 6, hoch: 2, niedrig: 1, schluessel: ["etwas weniger Talent", "keinen Platz im Kader"], abzeichen: "Kein Platz im Kader" },
];

// Wörter, die in keiner bekannten Kombination stehen und auf eine andere Einstufung hindeuten
export const WARNWOERTER = ["Weltklasse"];

export function ladeKombis(db: Database.Database): Kombi[] {
  const rows = db.prepare("SELECT rang, hoch, niedrig, schluessel, abzeichen, bestaetigt FROM scout_kombi").all() as {
    rang: number; hoch: number; niedrig: number; schluessel: string; abzeichen: string; bestaetigt: string;
  }[];
  return [...KOMBIS, ...rows.map((r) => ({ ...r, schluessel: [r.schluessel] }))];
}

export function bestaetigeKombi(db: Database.Database, k: { rang: number; hoch: number; niedrig: number; schluessel: string; abzeichen: string }) {
  db.prepare("INSERT OR REPLACE INTO scout_kombi (hoch, niedrig, schluessel, rang, abzeichen, bestaetigt) VALUES (?, ?, ?, ?, ?, ?)").run(
    k.hoch, k.niedrig, k.schluessel.trim(), k.rang, k.abzeichen.trim(), new Date().toISOString(),
  );
}

export type ScoutStatus = "ok" | "unbekannt" | "ohneText" | "keiner" | "loyal";
export type ScoutEinstufung = {
  status: ScoutStatus;
  rang?: number;
  abzeichen?: string;
  sterne?: string; // "4/2"
  grund?: string; // bei unbekannt / ohneText
  gefunden: string[]; // Schlüsselwörter im Text
};

const klein = (t: string) => t.toLocaleLowerCase("de-DE");

// Schlüsselwörter im Text; ein Treffer, der in einem längeren Treffer steckt, zählt nicht extra
// ("vielseitig" in "vielseitig, aber keine wirklichen Hauptstärken")
function treffer(text: string, kombis: Kombi[]) {
  const t = klein(text);
  const alle = kombis.flatMap((k) => k.schluessel.filter((s) => t.includes(klein(s))).map((s) => ({ s, k })));
  return alle.filter((a) => !alle.some((b) => b.s.length > a.s.length && klein(b.s).includes(klein(a.s))));
}

export function scoutEinstufung(sp: SpielerDaten, kombis: Kombi[] = KOMBIS): ScoutEinstufung {
  const st = sp.scoutSterne;
  if (st?.hoch === undefined || st?.niedrig === undefined) {
    return sp.loyal ? { status: "loyal", gefunden: [] } : { status: "keiner", gefunden: [] };
  }
  const sterne = `${st.hoch}/${st.niedrig}`;
  const nachSternen = kombis.filter((k) => k.hoch === st.hoch && k.niedrig === st.niedrig);
  if (!sp.scoutText) {
    const k = nachSternen[0];
    return k
      ? { status: "ohneText", rang: k.rang, abzeichen: k.abzeichen, sterne, grund: "Text noch nicht abgerufen, Rang nur aus den Sternen", gefunden: [] }
      : { status: "unbekannt", sterne, grund: `Sternekombination ${sterne} nicht in der Tabelle`, gefunden: [] };
  }
  if (sp.scoutTextSterne && sp.scoutTextSterne !== sterne) {
    return { status: "unbekannt", sterne, grund: `Text gehört zu ${sp.scoutTextSterne}, Sterne jetzt ${sterne}: neu abrufen`, gefunden: [] };
  }
  const tr = treffer(sp.scoutText, kombis);
  const gefunden = [...new Set(tr.map((x) => x.s))];
  const warn = WARNWOERTER.filter((w) => klein(sp.scoutText!).includes(klein(w)));
  if (warn.length) return { status: "unbekannt", sterne, grund: `unbekannter Begriff im Text: ${warn.join(", ")}`, gefunden };
  if (!nachSternen.length) return { status: "unbekannt", sterne, grund: `Sternekombination ${sterne} nicht in der Tabelle`, gefunden };
  if (!tr.length) return { status: "unbekannt", sterne, grund: "kein bekanntes Schlüsselwort im Text", gefunden };
  const raenge = [...new Set(tr.map((x) => x.k.rang))];
  const passend = nachSternen.find((k) => raenge.length === 1 && k.rang === raenge[0]);
  if (!passend) {
    return { status: "unbekannt", sterne, grund: `Sterne ${sterne} passen nicht zu „${gefunden.join("“, „")}“ (Rang ${raenge.join("/")})`, gefunden };
  }
  return { status: "ok", rang: passend.rang, abzeichen: passend.abzeichen, sterne, gefunden };
}

// Prognose je Skill nach den Sternen (Vorgabe Marcus): Stärken = Markierung 1 (Hoch), Schwächen = 2 (Niedrig)
export type SkillPrognose = { skill: Skill; label: string; wert?: number; gemaxt: boolean; art: "Stärke" | "Schwäche" | "offen"; prognose: string };

export function skillPrognose(sp: SpielerDaten): { skills: SkillPrognose[]; hinweise: string[] } {
  const st = sp.scoutSterne;
  const m = sp.scoutMarkierung ?? {};
  const hoch = st?.hoch;
  const niedrig = st?.niedrig;
  const staerke =
    hoch === 4 ? "mindestens eine Stärke wird 10" : hoch === 3 ? "endet bei 9 oder 10" : "keine Vorgabe für diese Sternezahl";
  const schwaeche = niedrig === 1 ? "endet ca. bei 4 bis 5" : niedrig === 2 ? "endet ca. bei 5 bis 6" : "keine Vorgabe für diese Sternezahl";
  const skills = ALLE_SKILLS.filter((s) => (s !== "form" && s !== "erfahrung") || m[s]).map((skill) => {
    const w = sp.skills[skill];
    const gemaxt = !!w?.gemaxt;
    const art = m[skill] === 1 ? "Stärke" : m[skill] === 2 ? "Schwäche" : "offen";
    const prognose = gemaxt
      ? "ausgemaxt (rot), sicher"
      : art === "Stärke"
        ? staerke
        : art === "Schwäche"
          ? schwaeche
          : "offen, höchstens so hoch wie die Stärken";
    return { skill, label: SKILL_LABEL[skill], wert: w?.wert, gemaxt, art, prognose } as SkillPrognose;
  });
  const hinweise: string[] = [];
  if (hoch === 4) hinweise.push("Hoch 4 Sterne: mindestens eine Stärke wird 10.");
  if (hoch === 3) hinweise.push("Hoch 3 Sterne: Stärken enden bei 9 oder 10.");
  if (niedrig === 1) hinweise.push("Niedrig 1 Stern: Schwächen enden ca. bei 4 bis 5.");
  if (niedrig === 2) hinweise.push("Niedrig 2 Sterne: Schwächen enden ca. bei 5 bis 6.");
  hinweise.push("Kein Skill wird höher als die Stärken.", "Nur rote Skills sind sicher ausgemaxt, alle anderen Werte sind Prognosen.");
  return { skills, hinweise };
}

// Für Sortierung: Rang 1–6, dann unbekannt, ohne Bericht, loyal
export const rangSortierung = (e: ScoutEinstufung) => (e.status === "ok" || e.status === "ohneText" ? e.rang! : e.status === "unbekannt" ? 7 : e.status === "keiner" ? 8 : 9);
