// Skill-Namen wie in mz-wissen.md. Reihenfolge = Reihenfolge der MZ-Formel (Abschnitt 6).
export const FORMEL_SKILLS = [
  "sprint",
  "ausdauer",
  "spieluebersicht",
  "passen",
  "schuss",
  "kopfball",
  "torwart",
  "technik",
  "zweikampf",
  "flanken",
  "erfahrung",
] as const;

export type FormelSkill = (typeof FORMEL_SKILLS)[number];

// Standards und Form zählen in der Formel nicht, werden aber angezeigt und verfolgt.
export const ALLE_SKILLS = [...FORMEL_SKILLS, "standards", "form"] as const;
export type Skill = (typeof ALLE_SKILLS)[number];

export const SKILL_LABEL: Record<Skill, string> = {
  sprint: "Sprint",
  ausdauer: "Ausdauer",
  spieluebersicht: "Spielübersicht",
  passen: "Passen",
  schuss: "Schuss",
  kopfball: "Kopfball",
  torwart: "Torwart",
  technik: "Technik",
  zweikampf: "Zweikampf",
  flanken: "Flanken",
  erfahrung: "Erfahrung",
  standards: "Standards",
  form: "Form",
};

export type SkillWert = {
  wert: number; // 0 bis 10
  gemaxt?: boolean; // rot auf ManagerZone
  markierung?: 1 | 2; // 1 = stärkste Skills, 2 = Schwächen
};

export type Skills = Partial<Record<Skill, SkillWert>>;
