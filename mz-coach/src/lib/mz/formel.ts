import { FORMEL_SKILLS, type FormelSkill, type Skills } from "./skills";

// MZ-Formel aus mz-wissen.md, Abschnitt 6 (mzlive "MZ Manager"-Wert = Summe Skill × Gewicht).
// Reihenfolge: Sprint, Ausdauer, Spielübersicht, Passen, Schuss, Kopfball, Torwart,
// Technik, Zweikampf, Flanken, Erfahrung
export const POSITIONEN = ["TW", "VT", "Anchorman", "MF", "Flügel", "Sturm"] as const;
export type Position = (typeof POSITIONEN)[number];
// Anzeige auf Deutsch (Marcus, 31.10.2026): "Anchorman" heißt in der Formel so, angezeigt wird "Sechser" (defensives
// Mittelfeld vor der Abwehr); die übrigen Kürzel sind schon deutsch.
export const posDe = (p: string) => (p === "Anchorman" ? "Sechser" : p);

const ROH: Record<Position, number[]> = {
  TW: [0.09, 0.09, 0.09, 0.02, 0, 0, 0.55, 0.09, 0, 0.02, 0.05],
  VT: [0.25, 0.16, 0.07, 0.02, 0, 0, 0, 0.08, 0.3, 0.07, 0.05],
  Anchorman: [0.25, 0.18, 0.05, 0.05, 0, 0.02, 0, 0.1, 0.25, 0.05, 0.05],
  MF: [0.15, 0.15, 0.1, 0.15, 0, 0, 0, 0.12, 0.2, 0.08, 0.05],
  Flügel: [0.25, 0.2, 0.06, 0.04, 0.05, 0, 0, 0.15, 0.05, 0.15, 0.05],
  Sturm: [0.23, 0.15, 0.05, 0.04, 0.28, 0.03, 0, 0.15, 0.02, 0, 0.05],
};

export const GEWICHTE: Record<Position, Record<FormelSkill, number>> = Object.fromEntries(
  POSITIONEN.map((p) => [p, Object.fromEntries(FORMEL_SKILLS.map((s, i) => [s, ROH[p][i]]))]),
) as Record<Position, Record<FormelSkill, number>>;

export type MzWert = { ok: true; wert: number } | { ok: false; fehlend: FormelSkill[] };

// Liefert den Wert nur, wenn alle Skills mit Gewicht > 0 bekannt sind. Nie schätzen.
export function mzWert(skills: Skills, position: Position): MzWert {
  const g = GEWICHTE[position];
  const fehlend = FORMEL_SKILLS.filter((s) => g[s] > 0 && skills[s] === undefined);
  if (fehlend.length) return { ok: false, fehlend };
  const summe = FORMEL_SKILLS.reduce((acc, s) => acc + g[s] * (skills[s]?.wert ?? 0), 0);
  return { ok: true, wert: Math.round(summe * 100) / 100 };
}

// MZ-Werte eines Spielers für alle Rollen
export function alleMzWerte(skills: Skills): Record<Position, MzWert> {
  return Object.fromEntries(POSITIONEN.map((p) => [p, mzWert(skills, p)])) as Record<Position, MzWert>;
}
