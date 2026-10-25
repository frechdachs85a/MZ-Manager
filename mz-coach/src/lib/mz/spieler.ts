import { ALLE_SKILLS, SKILL_LABEL, type Skill, type Skills } from "./skills";

// Alles, was über einen eigenen Spieler gespeichert wird. Felder ohne echten Wert bleiben leer.
export type SpielerDaten = {
  pid: number;
  name: string;
  nr?: number;
  alter?: number;
  skills: Skills;
  marktwert?: number;
  scoutSterne?: { hoch?: number; niedrig?: number };
  status?: {
    trainingslager?: boolean;
    verletzt?: boolean;
    gesperrt?: boolean;
    transfermarkt?: boolean;
    // Taktikseite: Spieler mit Kegel (Klasse "tc") sind nicht aufstellbar. Trainingslager allein
    // reicht dafür nicht: mit Chip oder im Jugendaufbau-Trainingslager bleibt er aufstellbar (Marcus, 24.10.2026).
    aufstellbar?: boolean;
  };
  // Stand (ISO) der Seite, aus der der jeweilige Status stammt
  statusStand?: { verletzt?: string; gesperrt?: string; trainingslager?: string; aufstellbar?: string; scout?: string };
  // Aus dem Scoutbericht der Spieleransicht (?p=players): 1 = Hoch, 2 = Niedrig, je Skill.
  // Getrennt von den Skills gespeichert, weil die Kaderübersicht sie nicht enthält.
  scoutMarkierung?: Partial<Record<Skill, 1 | 2>>;
  scoutTraining?: number; // Sterne "Tr. Geschwindigkeit"
  sperren?: Sperre[];
  // Aus der Spieleransicht (?p=players). Arbeitsbewilligung nur, wenn die Zeile dort steht.
  nationalitaet?: string;
  arbeitsbewilligung?: { land: string; tage?: number };
  trainingslagerInfo?: TrainingslagerInfo;
};

// Zeile aus "Platzverweise" auf ?p=players&sub=unavailable. Eine Sperre gilt je Wettbewerb.
export type Sperre = {
  karte: string; // Bildtitel auf der Seite, z. B. "Rote Karte"
  wettbewerb: string; // z. B. "Tag der Deutschen Einheit Pokal 2026"
  spiele: number;
  art: string; // Begegnungsart, z. B. "Offizieller Pokal"
  datum: string; // JJJJ-MM-TT
};

// Block auf ?p=training_camp
export type TrainingslagerInfo = {
  paket: string; // z. B. "Torjägerpaket Nr. 5" oder "Jugendaufbautrainingslager"
  eigenschaft?: string; // aktuell trainierter Skill
  dauerWochen?: number;
  verbleibendeTage?: number;
  start?: string;
  ende?: string;
};

export type Aenderung = { feld: string; alt: string | null; neu: string | null };

function txt(v: unknown): string | null {
  return v === undefined || v === null ? null : String(v);
}

// Vergleicht zwei Stände desselben Spielers. Nur Felder, die in BEIDEN Ständen
// bekannt sind, gelten als Änderung (fehlende Werte sind keine Änderung).
export function aenderungen(alt: SpielerDaten, neu: SpielerDaten): Aenderung[] {
  const out: Aenderung[] = [];
  for (const s of ALLE_SKILLS) {
    const a = alt.skills[s];
    const n = neu.skills[s];
    if (!a || !n) continue;
    if (a.wert !== n.wert) out.push({ feld: SKILL_LABEL[s], alt: txt(a.wert), neu: txt(n.wert) });
    if (!a.gemaxt && n.gemaxt) out.push({ feld: `${SKILL_LABEL[s]} gemaxt`, alt: "nein", neu: "ja" });
  }
  if (alt.marktwert !== undefined && neu.marktwert !== undefined && alt.marktwert !== neu.marktwert) {
    out.push({ feld: "Marktwert", alt: txt(alt.marktwert), neu: txt(neu.marktwert) });
  }
  if (alt.alter !== undefined && neu.alter !== undefined && alt.alter !== neu.alter) {
    out.push({ feld: "Alter", alt: txt(alt.alter), neu: txt(neu.alter) });
  }
  const st = ["trainingslager", "verletzt", "gesperrt", "transfermarkt", "aufstellbar"] as const;
  for (const k of st) {
    const a = alt.status?.[k];
    const n = neu.status?.[k];
    if (a !== undefined && n !== undefined && a !== n) {
      out.push({ feld: k[0].toUpperCase() + k.slice(1), alt: a ? "ja" : "nein", neu: n ? "ja" : "nein" });
    }
  }
  return out;
}
