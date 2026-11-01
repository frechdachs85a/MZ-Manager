import type Database from "better-sqlite3";
import type { KaderEintrag } from "@/lib/db/kader";
import { ladeTaktiken } from "@/lib/db/taktik";
import { POSITIONEN, mzWert, type Position } from "@/lib/mz/formel";
import { SKILL_LABEL, type Skill, type Skills } from "@/lib/mz/skills";
import type { Bilanz } from "@/lib/skill-bilanz";
import { alterGrenze, pruefeTaktikGegenKader, taktikCheck, type AlterGrenze } from "@/lib/taktik-check";
import { einsatzImLigaspiel } from "@/lib/mz/einsatz";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { heuteInBerlin } from "@/lib/format";
import { naechsterLigaspieltag } from "@/lib/wissen/startbasis";

// Bälle der letzten 14 Tage mit Folgen (Marcus, 31.10.2026): je Spieler Rückennummer, MZ-Wert vorher und jetzt und ob er
// es DURCH DIE BÄLLE in eine Taktik schafft oder herausfällt (01.11.2026: nur dann, nicht wenn er ohnehin drin wäre).
// MZ-Wert vorher = heutige Skills minus die Änderungen der 14 Tage, Formel aus mz-wissen.md, Abschnitt 6, auf der Position,
// auf der er heute am besten ist.
// Taktiken: für jeden Editor-Reiter (ohne Liga und freund) die tägliche Prüfung (taktik-check.ts) zweimal rechnen, mit
// seinen heutigen Skills und mit den Skills von vor 14 Tagen. Nur wenn sich seine Startelf-Zugehörigkeit dadurch ändert,
// liegt es an den Bällen. Spieler, die im nächsten Ligaspiel nicht einsetzbar sind (Trainingslager, verletzt, gesperrt),
// werden dafür als einsetzbar gerechnet und mit „nach dem Trainingslager“ usw. gemeldet.
// freund zählt nicht (Marcus, 01.11.2026): dort sitzen die wichtigsten Spieler bewusst auf der Bank.

export type WertVerlauf = { position: Position; vorher: number; jetzt: number };

const LABEL_ZU_SKILL = new Map(Object.entries(SKILL_LABEL).map(([k, v]) => [v, k as Skill]));
const startelf = (xml: string) => new Set([...xml.matchAll(/<Pos\b[^>]*\spid="(\d+)"/g)].map((m) => Number(m[1])));
const nachname = (n: string) => n.split(" ").at(-1) ?? n;

// MZ-Wert vor den Änderungen und heute auf der heute besten Position
export function vorherSkillsVon(s: SpielerDaten, b: Bilanz): Skills {
  const vorherSkills: Skills = { ...s.skills };
  for (const a of b.aenderungen) {
    const k = LABEL_ZU_SKILL.get(a.skill);
    const sw = k ? vorherSkills[k] : undefined;
    if (k && sw) vorherSkills[k] = { ...sw, wert: sw.wert - (a.neu - a.alt) };
  }
  return vorherSkills;
}

export function wertVerlauf(s: KaderEintrag, b: Bilanz): WertVerlauf | null {
  const vorherSkills = vorherSkillsVon(s, b);
  let beste: WertVerlauf | null = null;
  for (const p of POSITIONEN) {
    const j = mzWert(s.skills, p);
    const v = mzWert(vorherSkills, p);
    if (j.ok && v.ok && (!beste || j.wert > beste.jetzt)) beste = { position: p, vorher: v.wert, jetzt: j.wert };
  }
  return beste;
}

export type TaktikFolge = { reiter: string; art: "neu" | "raus" | "drin"; nachAusfall?: string; statt?: string };

const ausfallText = (s: SpielerDaten) =>
  s.status?.trainingslager ? "nach dem Trainingslager" : s.status?.verletzt ? "nach der Verletzung" : s.status?.gesperrt ? "nach der Sperre" : "sobald aufstellbar";

// Folgen der Bälle eines Spielers über alle Reiter (rechnet die Prüfung mit alten und neuen Skills)
export function taktikFolgen(
  reiter: { reiter: string; xml: string; alter?: AlterGrenze }[],
  kader: SpielerDaten[],
  spieler: SpielerDaten,
  vorherSkills: Skills,
  spieltag: Date,
): TaktikFolge[] {
  const ausfall = einsatzImLigaspiel(spieler, spieltag).lage === "nicht_bereit";
  const frei: SpielerDaten = ausfall ? { ...spieler, status: { ...spieler.status, trainingslager: false, verletzt: false, gesperrt: false, aufstellbar: true } } : spieler;
  const mit = (sk: Skills) => kader.map((s) => (s.pid === spieler.pid ? { ...frei, skills: sk } : s));
  const kJetzt = mit(spieler.skills);
  const kVorher = mit(vorherSkills);
  const name = nachname(spieler.name);
  const out: TaktikFolge[] = [];
  for (const r of reiter) {
    const jetzt = pruefeTaktikGegenKader(r.reiter, r.xml, kJetzt, spieltag, r.alter);
    const vorher = pruefeTaktikGegenKader(r.reiter, r.xml, kVorher, spieltag, r.alter);
    if (jetzt.fehler || vorher.fehler) continue;
    const j = startelf(jetzt.xml).has(spieler.pid);
    const v = startelf(vorher.xml).has(spieler.pid);
    const nachAusfall = ausfall ? ausfallText(spieler) : undefined;
    if (j && !v) out.push({ reiter: r.reiter, art: "neu", nachAusfall, statt: jetzt.aenderungen.find((a) => a.neu === name)?.alt });
    else if (!j && v) out.push({ reiter: r.reiter, art: "raus", nachAusfall });
    else if (j && v) out.push({ reiter: r.reiter, art: "drin", nachAusfall });
  }
  return out;
}

// Für die Zentrale: alles je pid
export function baelleFolgen(db: Database.Database, bilanz: Bilanz[], kader: KaderEintrag[]) {
  const spieltag = naechsterLigaspieltag(heuteInBerlin());
  const imEditor = new Set(taktikCheck(db).filter((c) => !c.fehler).map((c) => c.reiter));
  const reiter = ladeTaktiken(db)
    .filter((t) => imEditor.has(t.reiter) && !/^freund$/i.test(t.reiter))
    .map((t) => ({ reiter: t.reiter, xml: t.xml, alter: alterGrenze(db, t.reiter) }));
  const nach = new Map(kader.map((s) => [s.pid, s]));
  return new Map(
    bilanz.map((b) => {
      const s = nach.get(b.pid);
      return [
        b.pid,
        {
          nr: s?.nr,
          wert: s ? wertVerlauf(s, b) : null,
          folgen: s ? taktikFolgen(reiter, kader, s, vorherSkillsVon(s, b), spieltag) : [],
        },
      ] as const;
    }),
  );
}
