import { GEWICHTE, mzWert, type Position } from "@/lib/mz/formel";
import { FORMEL_SKILLS, SKILL_LABEL, type Skills } from "@/lib/mz/skills";

// Potenzial eines Spielers in einer Rolle (Marcus, 31.10.2026: Vorschläge mit Potenzial zur Verbesserung). Nur was die
// Seite sicher weiß: welche Skills mit Gewicht in dieser Rolle noch nicht ausgemaxt sind (schwarz auf ManagerZone), und
// der MZ-Wert, wenn jeder davon einen Ball mehr hätte. Wie weit ein Skill wirklich steigt, ist unbekannt.
export type Potenzial = { trainierbar: string[]; plusEins?: number };

export function potenzial(skills: Skills, rolle: Position): Potenzial {
  const g = GEWICHTE[rolle];
  const offen = FORMEL_SKILLS.filter((s) => g[s] > 0 && skills[s]?.gemaxt === false && (skills[s]?.wert ?? 10) < 10);
  if (!offen.length) return { trainierbar: [] };
  const mehr: Skills = { ...skills };
  for (const s of offen) mehr[s] = { ...skills[s]!, wert: Math.min(10, skills[s]!.wert + 1) };
  const w = mzWert(mehr, rolle);
  return { trainierbar: offen.map((s) => SKILL_LABEL[s]), plusEins: w.ok ? w.wert : undefined };
}
