import type Database from "better-sqlite3";
import type { KaderEintrag } from "@/lib/db/kader";
import { ladeTaktiken } from "@/lib/db/taktik";
import { POSITIONEN, mzWert, type Position } from "@/lib/mz/formel";
import { SKILL_LABEL, type Skill, type Skills } from "@/lib/mz/skills";
import type { Bilanz } from "@/lib/skill-bilanz";
import { taktikCheck, type TaktikCheck } from "@/lib/taktik-check";

// Bälle der letzten 14 Tage mit Folgen (Marcus, 31.10.2026): je Spieler Rückennummer, MZ-Wert vorher und jetzt und ob er
// es dadurch in eine Taktik schafft oder herausfällt (weil ein anderer besser wurde oder er schlechter).
// MZ-Wert vorher = heutige Skills minus die Änderungen der 14 Tage, Formel aus mz-wissen.md, Abschnitt 6, auf der Position,
// auf der er heute am besten ist. Taktiken: Startelf (Pos-Zeilen) jedes Editor-Reiters, wie er jetzt ist, gegen den
// Vorschlag der täglichen Prüfung (taktik-check.ts); Liga: die zuletzt geschriebene gegen die davor geschriebene Liga.

export type WertVerlauf = { position: Position; vorher: number; jetzt: number };
export type TaktikFolge = { reiter: string; art: "drin" | "neu" | "raus" | "liga-neu" | "liga-raus"; grund?: string };

const LABEL_ZU_SKILL = new Map(Object.entries(SKILL_LABEL).map(([k, v]) => [v, k as Skill]));
const startelf = (xml: string) => new Set([...xml.matchAll(/<Pos\b[^>]*\spid="(\d+)"/g)].map((m) => Number(m[1])));
const nachname = (n: string) => n.split(" ").at(-1) ?? n;

// MZ-Wert vor den Änderungen und heute auf der heute besten Position
export function wertVerlauf(s: KaderEintrag, b: Bilanz): WertVerlauf | null {
  const vorherSkills: Skills = { ...s.skills };
  for (const a of b.aenderungen) {
    const k = LABEL_ZU_SKILL.get(a.skill);
    const sw = k ? vorherSkills[k] : undefined;
    if (k && sw) vorherSkills[k] = { ...sw, wert: sw.wert - (a.neu - a.alt) };
  }
  let beste: WertVerlauf | null = null;
  for (const p of POSITIONEN) {
    const j = mzWert(s.skills, p);
    const v = mzWert(vorherSkills, p);
    if (j.ok && v.ok && (!beste || j.wert > beste.jetzt)) beste = { position: p, vorher: v.wert, jetzt: j.wert };
  }
  return beste;
}

// Taktik-Folgen je Spieler aus den Reiter-Prüfungen und den zwei zuletzt geschriebenen Liga-Formationen
export function taktikFolgen(
  checks: TaktikCheck[],
  aktuell: { reiter: string; xml: string }[],
  liga: { jetzt?: string; vorher?: string },
  spieler: { pid: number; name: string; schlechter: boolean },
): TaktikFolge[] {
  const out: TaktikFolge[] = [];
  const name = nachname(spieler.name);
  for (const c of checks) {
    const alt = aktuell.find((a) => a.reiter === c.reiter)?.xml;
    if (!alt) continue;
    const war = startelf(alt).has(spieler.pid);
    const wird = startelf(c.xml).has(spieler.pid);
    if (war && wird) out.push({ reiter: c.reiter, art: "drin" });
    else if (!war && wird) {
      const fuer = c.aenderungen.find((a) => a.neu === name);
      out.push({ reiter: c.reiter, art: "neu", grund: fuer ? `statt ${fuer.alt}` : undefined });
    } else if (war && !wird) {
      const ersatz = c.aenderungen.find((a) => a.alt === name);
      const grund = ersatz?.grund ?? (spieler.schlechter ? "schlechter geworden" : ersatz ? `${ersatz.neu} ist besser` : undefined);
      out.push({ reiter: c.reiter, art: "raus", grund });
    }
  }
  if (liga.jetzt) {
    const jetzt = startelf(liga.jetzt).has(spieler.pid);
    const vorher = liga.vorher ? startelf(liga.vorher).has(spieler.pid) : jetzt;
    if (jetzt && vorher) out.push({ reiter: "Liga", art: "drin" });
    else if (jetzt) out.push({ reiter: "Liga", art: "liga-neu" });
    else if (vorher) out.push({ reiter: "Liga", art: "liga-raus", grund: spieler.schlechter ? "schlechter geworden" : undefined });
  }
  return out;
}

// Für die Zentrale: alles je pid
export function baelleFolgen(db: Database.Database, bilanz: Bilanz[], kader: KaderEintrag[]) {
  const checks = taktikCheck(db).filter((c) => !c.fehler);
  const aktuell = ladeTaktiken(db);
  const ligaRoh = db.prepare("SELECT html_roh AS xml FROM rohseite WHERE art = 'liga-xml' ORDER BY id DESC LIMIT 2").all() as { xml: string | null }[];
  const liga = { jetzt: ligaRoh[0]?.xml ?? undefined, vorher: ligaRoh[1]?.xml ?? undefined };
  const nach = new Map(kader.map((s) => [s.pid, s]));
  return new Map(
    bilanz.map((b) => {
      const s = nach.get(b.pid);
      return [
        b.pid,
        {
          nr: s?.nr,
          wert: s ? wertVerlauf(s, b) : null,
          folgen: taktikFolgen(checks, aktuell, liga, { pid: b.pid, name: b.name, schlechter: b.minus > b.plus }),
        },
      ] as const;
    }),
  );
}
