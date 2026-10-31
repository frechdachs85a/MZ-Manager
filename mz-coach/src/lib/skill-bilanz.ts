import type Database from "better-sqlite3";
import { SKILL_LABEL } from "@/lib/mz/skills";

// Skill-Bilanz der letzten Tage (Marcus, 30.10.2026): wer hat wie viele Bälle bekommen oder verloren, und Warnungen,
// wenn ein Verlust die Einsatzfähigkeit ändert. Quelle: Änderungsliste der Kaderabrufe (spieler_aenderung).
// Form zählt nicht (schwankt wöchentlich, kein Trainingsball).
// Ausdauer unter 8 (Marcus): der Spieler hält nicht über 90 Minuten durch, ein Wechsel muss eingeplant werden.
export const AUSDAUER_GRENZE = 8;
const SKILLS = new Set(Object.entries(SKILL_LABEL).filter(([k]) => k !== "form").map(([, v]) => v));

export type Bilanz = { pid: number; name: string; plus: number; minus: number; aenderungen: { skill: string; alt: number; neu: number; datum: string }[] };
export type Warnung = { pid: number; name: string; text: string };

// Bälle je Spieler in den letzten `tage` Tagen, dazu Warnungen (Ausdauer unter die Grenze gefallen)
export function skillBilanz(db: Database.Database, tage = 14, jetzt = new Date()): { bilanz: Bilanz[]; warnungen: Warnung[] } {
  const ab = new Date(jetzt.getTime() - tage * 24 * 3600_000).toISOString();
  const rows = db
    .prepare(
      `SELECT a.pid, s.name, a.datum, a.feld, a.alt, a.neu FROM spieler_aenderung a JOIN spieler s ON s.pid = a.pid
       WHERE s.aktiv = 1 AND a.datum >= ? ORDER BY a.datum`,
    )
    .all(ab) as { pid: number; name: string; datum: string; feld: string; alt: string | null; neu: string | null }[];
  const je = new Map<number, Bilanz>();
  const warnungen: Warnung[] = [];
  for (const r of rows) {
    if (!SKILLS.has(r.feld)) continue;
    const alt = Number(r.alt);
    const neu = Number(r.neu);
    if (!Number.isFinite(alt) || !Number.isFinite(neu) || alt === neu) continue;
    const b = je.get(r.pid) ?? { pid: r.pid, name: r.name, plus: 0, minus: 0, aenderungen: [] };
    if (neu > alt) b.plus += neu - alt;
    else b.minus += alt - neu;
    b.aenderungen.push({ skill: r.feld, alt, neu, datum: r.datum });
    je.set(r.pid, b);
    if (r.feld === SKILL_LABEL.ausdauer && alt >= AUSDAUER_GRENZE && neu < AUSDAUER_GRENZE) {
      warnungen.push({ pid: r.pid, name: r.name, text: `Ausdauer ${alt} → ${neu}: hält keine 90 Minuten mehr durch, Wechsel einplanen` });
    }
  }
  return { bilanz: [...je.values()].sort((a, b) => b.plus - b.minus - (a.plus - a.minus)), warnungen };
}
