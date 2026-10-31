import { GEWICHTE, type Position } from "@/lib/mz/formel";
import { FORMEL_SKILLS, SKILL_LABEL, type FormelSkill } from "@/lib/mz/skills";
import { MIN_AUSDAUER, MIN_SPRINT, type Schwachstelle } from "@/lib/mz/analyse/markt";

// Gezielte Transfermarktsuche (Marcus, 26.10.2026): statt den ganzen Markt zu lesen, mit den Filtern von
// ManagerZone nur Spieler holen, die eine Schwachstelle verbessern können.
// Feldnamen laut Suchformular #searchform (Diagnose vom 26.10.2026): s0a/s0b … s12a/s12b = Mindest-/Höchstwert für
// Sprint, Ausdauer, Spielübersicht, Passen, Schuss, Kopfball, Torwart, Technik, Zweikampf, Flanken, Standards,
// Erfahrung, Form; agea/ageb Alter; valuea/valueb Wert; bida/bidb letztes Gebot.
export const SKILL_FELD: Record<FormelSkill, string> = {
  sprint: "s0",
  ausdauer: "s1",
  spieluebersicht: "s2",
  passen: "s3",
  schuss: "s4",
  kopfball: "s5",
  torwart: "s6",
  technik: "s7",
  zweikampf: "s8",
  flanken: "s9",
  erfahrung: "s11",
};

// Ersetzt Werte in der Parameterkette des Formulars (&name=wert…), unbekannte Namen werden angehängt
export function mitFiltern(params: string, filter: Record<string, string | number>): string {
  let out = params;
  for (const [k, v] of Object.entries(filter)) {
    const re = new RegExp(`&${k}=[^&]*`);
    const teil = `&${k}=${encodeURIComponent(String(v))}`;
    out = re.test(out) ? out.replace(re, teil) : out + teil;
  }
  return out;
}

// Kleinster Wert, den ein Skill haben muss, damit der MZ-Wert in dieser Rolle über `alt` liegen KANN, wenn alle
// anderen Skills 10 wären. Damit schließt der Filter nie einen Spieler aus, der die Stelle verbessern würde.
export function sichereUntergrenze(rolle: Position, skill: FormelSkill, alt: number): number {
  const g = GEWICHTE[rolle];
  if (!g[skill]) return 0;
  const rest = FORMEL_SKILLS.filter((s) => s !== skill).reduce((n, s) => n + g[s] * 10, 0);
  const x = (alt - rest) / g[skill];
  return x < 0 ? 0 : Math.min(10, Math.floor(x + 1e-9) + 1);
}

export type SuchZiel = {
  rolle: Position;
  wert: number; // MZ-Wert des jetzigen Spielers
  spieler: string;
  hauptskill: FormelSkill; // höchstes Gewicht in der Rolle
  untergrenze: number; // sichere Untergrenze des Hauptskills
  stufen: number[]; // Mindestwerte des Hauptskills, von 10 abwärts bis zur Untergrenze
  filter: (stufe: number) => Record<string, number>;
  text: string;
};

// Je Rolle die schwächste Stelle der Startelf (höchstens `anzahl` Rollen), schwächste zuerst
export function suchZiele(schwach: Schwachstelle[], anzahl = 3): SuchZiel[] {
  const gesehen = new Set<Position>();
  const ziele: SuchZiel[] = [];
  // Vorrang: Ausdauerproblem ohne freien Wechsel, sonst schwächster MZ-Wert zuerst
  for (const s of [...schwach].sort((a, b) => Number(!!b.ohneWechsel) - Number(!!a.ohneWechsel) || a.wert - b.wert)) {
    if (gesehen.has(s.rolle) || ziele.length >= anzahl) continue;
    gesehen.add(s.rolle);
    const g = GEWICHTE[s.rolle];
    const hauptskill = [...FORMEL_SKILLS].sort((a, b) => g[b] - g[a])[0];
    const untergrenze = Math.max(sichereUntergrenze(s.rolle, hauptskill, s.wert), hauptskill === "sprint" ? MIN_SPRINT : hauptskill === "ausdauer" ? MIN_AUSDAUER : 0);
    const stufen: number[] = [];
    for (let st = 10; st >= Math.max(untergrenze, 1); st--) stufen.push(st);
    ziele.push({
      rolle: s.rolle,
      wert: s.wert,
      spieler: s.spieler.name,
      hauptskill,
      untergrenze,
      stufen,
      // 99-Regel als Filter (Sprint und Ausdauer mindestens 9), Hauptskill der Rolle genau auf der jeweiligen Stufe
      // (von 10 abwärts, so kommt kein Spieler doppelt und die besten zuerst)
      filter: (stufe) => ({
        [`${SKILL_FELD.sprint}a`]: MIN_SPRINT,
        [`${SKILL_FELD.ausdauer}a`]: MIN_AUSDAUER,
        [`${SKILL_FELD[hauptskill]}a`]: stufe,
        [`${SKILL_FELD[hauptskill]}b`]: stufe,
      }),
      text: `${s.rolle} (jetzt ${s.spieler.name}, ${s.wert.toFixed(2).replace(".", ",")}${s.ohneWechsel ? `, Ausdauer ${s.spieler.skills.ausdauer?.wert} ohne freien Wechsel` : ""}): ${SKILL_LABEL[hauptskill]} Stufe für Stufe von ${stufen[0] ?? untergrenze} bis ${untergrenze}; Sprint und Ausdauer ab ${MIN_SPRINT}, zusammen ab 17`,
    });
  }
  return ziele;
}
