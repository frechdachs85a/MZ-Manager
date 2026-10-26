import { GEWICHTE, mzWert, type Position } from "@/lib/mz/formel";
import { FORMEL_SKILLS, SKILL_LABEL } from "@/lib/mz/skills";
import type { SpielerDaten } from "@/lib/mz/spieler";
import { istAussen, STURM_Y } from "@/lib/mz/taktik/pruefer";
import type { MarktSpieler } from "@/lib/mz/parser/transfer";
import { ABWEHR_Y } from "./gegner";

// Transfermarkt-Empfehlung (Auftrag Abschnitt 6, Ergänzung Marcus 25.10.2026).
// Alles wird aus gespeicherten Daten berechnet: Startelf aus dem letzten eigenen Spiel,
// MZ-Werte nach der Formel (mz-wissen.md, Abschnitt 6), Regeln aus Abschnitt 7.

// Nationalität, die als einheimisch gilt. FC Toho spielt in der Seniorenliga Germany; geschrieben
// wie auf der deutschen Spieleransicht ("Nationalität: Deutschland").
export const HEIMATLAND = "Deutschland";
export const MIN_SPRINT = 9; // 99-Regel (mz-wissen.md, Abschnitt 7)
export const MIN_AUSDAUER = 9;
export const ALTER_ABBAU = 30; // ab 30: erst Sprint, dann Ausdauer weg

export type Slot = { pid: number; x: number; y: number; torwart: boolean };

// Arbeitsdefinition für die Rolle eines Startplatzes aus den Editor-Koordinaten: Torwart; Abwehr
// y >= 215 (VT, siehe ABWEHR_Y); Sturm y <= 110; außen x <= 40 oder >= 170 (Flügel); sonst Mittelfeld (MF).
// Anchorman wird nicht zugeordnet, weil seine Lage im Editor nicht festgelegt ist.
export function rolle(s: Slot): Position {
  if (s.torwart) return "TW";
  if (s.y >= ABWEHR_Y) return "VT";
  if (istAussen(s.x)) return "Flügel";
  return s.y <= STURM_Y ? "Sturm" : "MF";
}

export type Schwachstelle = { slot: Slot; rolle: Position; spieler: SpielerDaten; wert: number };

// Jeder Startplatz mit dem MZ-Wert seines Spielers in dieser Rolle, schwächster zuerst.
// Plätze, deren Spieler nicht im Kader steht oder deren Skills fehlen, werden mit Grund gemeldet.
export function schwachstellen(elf: Slot[], kader: SpielerDaten[]): { liste: Schwachstelle[]; fehlt: string[] } {
  const nachPid = new Map(kader.map((s) => [s.pid, s]));
  const liste: Schwachstelle[] = [];
  const fehlt: string[] = [];
  for (const slot of elf) {
    const spieler = nachPid.get(slot.pid);
    const r = rolle(slot);
    if (!spieler) {
      fehlt.push(`pid ${slot.pid} (${slot.x}/${slot.y}) ist nicht im gespeicherten Kader.`);
      continue;
    }
    const w = mzWert(spieler.skills, r);
    if (!w.ok) {
      fehlt.push(`${spieler.name}: Skills fehlen für den ${r}-Wert.`);
      continue;
    }
    liste.push({ slot, rolle: r, spieler, wert: w.wert });
  }
  return { liste: liste.sort((a, b) => a.wert - b.wert), fehlt };
}

export type MarktRahmen = {
  kapital?: number; // EUR, von Marcus eingetragen
  // Freie Plätze laut Gebotsfenster: "Ausländische Spieler n (maximum m)" und "Arbeitsbewilligungen n
  // (maximum m)". Ein Ausländer mit Arbeitsbewilligung zählt nicht als ausländischer Spieler (am Kader
  // vom 24.10.2026 bestätigt: 7 Ausländer, 2 mit Arbeitsbewilligung, Anzeige "Ausländische Spieler: 5").
  auslaenderFrei?: number;
  bewilligungenFrei?: number;
  abgelehnt: Set<number>;
  eigene: Set<number>;
  // Vereine, mit denen keine Transfers erlaubt sind (Team der Frau, Support-Mail ManagerZone)
  gesperrteTeams?: Set<number>;
};

export type Grund =
  | "abgelehnt"
  | "eigener"
  | "skills"
  | "99-regel"
  | "keine-verbesserung"
  | "preis-unbekannt"
  | "zu-teuer"
  | "nationalitaet-unbekannt"
  | "auslaender"
  | "gesperrter-verein"
  | "verein-unbekannt";

export const GRUND_TEXT: Record<Grund, string> = {
  abgelehnt: "von dir abgelehnt",
  eigener: "eigener Spieler",
  skills: "Skills nicht vollständig sichtbar",
  "99-regel": `99-Regel nicht erfüllt (Sprint und Ausdauer je ${MIN_SPRINT}+)`,
  "keine-verbesserung": "verbessert keinen Startplatz",
  "preis-unbekannt": "Preis nicht lesbar",
  "zu-teuer": "teurer als dein Kapital",
  "nationalitaet-unbekannt": "Nationalität nicht lesbar",
  auslaender: "kein freier Ausländerplatz und keine freie Arbeitsbewilligung",
  "gesperrter-verein": "Verein, mit dem keine Transfers erlaubt sind",
  "verein-unbekannt": "Verein nicht lesbar (Transfersperre nicht prüfbar)",
};

export type Bewertung = {
  kandidat: MarktSpieler;
  ziel: Schwachstelle; // der Startplatz, den er am stärksten verbessert
  neu: number; // MZ-Wert des Kandidaten in dieser Rolle
  gewinn: number;
  preis: number;
  elfVorher: number;
  elfNachher: number;
  gruende: string[];
  vorbehalte: string[];
};

export type MarktErgebnis = {
  empfehlung: Bewertung | null;
  weitere: Bewertung[]; // nächste Kandidaten in Reihenfolge
  ausgeschlossen: Partial<Record<Grund, number>>;
  geprueft: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const eur = (n: number) => `${new Intl.NumberFormat("de-DE").format(n)} €`;

// Preis, der mindestens zu zahlen ist: das höhere aus gefordert und Höchstgebot
export function mindestpreis(k: MarktSpieler): number | undefined {
  const p = [k.markt.gefordert, k.markt.hoechstgebot].filter((x): x is number => x !== undefined);
  return p.length ? Math.max(...p) : undefined;
}

// Skills, in denen der Kandidat in dieser Rolle mehr bringt, nach Beitrag (Gewicht × Unterschied)
function staerken(k: MarktSpieler, alt: SpielerDaten, r: Position): string[] {
  const g = GEWICHTE[r];
  return FORMEL_SKILLS.filter((s) => g[s] > 0)
    .map((s) => ({ s, neu: k.skills[s]?.wert ?? 0, alt: alt.skills[s]?.wert ?? 0 }))
    .filter((x) => x.neu > x.alt)
    .sort((a, b) => g[b.s] * (b.neu - b.alt) - g[a.s] * (a.neu - a.alt))
    .slice(0, 4)
    .map((x) => `${SKILL_LABEL[x.s]} ${x.neu} statt ${x.alt} (Gewicht ${String(g[x.s]).replace(".", ",")})`);
}

// Kandidaten gegen deine Schwachstellen bewerten (mit Rahmen)
export function bewerteMarkt(kandidaten: MarktSpieler[], schwach: Schwachstelle[], rahmen: MarktRahmen): MarktErgebnis {
  const ausgeschlossen: Partial<Record<Grund, number>> = {};
  const raus = (g: Grund) => {
    ausgeschlossen[g] = (ausgeschlossen[g] ?? 0) + 1;
    return null;
  };
  const elfVorher = schwach.reduce((n, s) => n + s.wert, 0);

  const bewertet = kandidaten.map((k): Bewertung | null => {
    if (rahmen.eigene.has(k.pid)) return raus("eigener");
    if (rahmen.abgelehnt.has(k.pid)) return raus("abgelehnt");
    if (rahmen.gesperrteTeams?.size) {
      if (k.markt.verkaeuferTid === undefined) return raus("verein-unbekannt");
      if (rahmen.gesperrteTeams.has(k.markt.verkaeuferTid)) return raus("gesperrter-verein");
    }
    if (FORMEL_SKILLS.some((s) => k.skills[s] === undefined)) return raus("skills");
    if (k.skills.sprint!.wert < MIN_SPRINT || k.skills.ausdauer!.wert < MIN_AUSDAUER) return raus("99-regel");

    // Startplatz mit dem größten Gewinn
    let bester: { ziel: Schwachstelle; neu: number; gewinn: number } | null = null;
    for (const s of schwach) {
      const w = mzWert(k.skills, s.rolle);
      if (!w.ok) continue;
      const gewinn = r2(w.wert - s.wert);
      if (gewinn > 0 && (!bester || gewinn > bester.gewinn)) bester = { ziel: s, neu: w.wert, gewinn };
    }
    if (!bester) return raus("keine-verbesserung");

    const preis = mindestpreis(k);
    if (preis === undefined) return raus("preis-unbekannt");
    if (rahmen.kapital !== undefined && preis > rahmen.kapital) return raus("zu-teuer");
    if (!k.nationalitaet) return raus("nationalitaet-unbekannt");
    const auslaender = k.nationalitaet !== HEIMATLAND;
    const platzFrei = (rahmen.auslaenderFrei ?? 0) > 0;
    const bewilligungNoetig = auslaender && !platzFrei;
    if (bewilligungNoetig && (rahmen.bewilligungenFrei ?? 0) <= 0) return raus("auslaender");

    const { ziel, neu, gewinn } = bester;
    const elfNachher = elfVorher + gewinn;
    const istGroesste = ziel === schwach[0];
    const gruende = [
      `${istGroesste ? "Größte Schwachstelle" : "Schwachstelle"}: ${ziel.rolle} auf ${ziel.slot.x}/${ziel.slot.y}, dort spielt ${ziel.spieler.name} mit ${ziel.wert.toFixed(2)}.`,
      `${k.name} hätte als ${ziel.rolle} ${neu.toFixed(2)}, also +${gewinn.toFixed(2)}.`,
      `Startelf gesamt ${r2(elfVorher).toFixed(2)} → ${r2(elfNachher).toFixed(2)} (+${((gewinn / elfVorher) * 100).toFixed(1).replace(".", ",")} %).`,
    ];
    const st = staerken(k, ziel.spieler, ziel.rolle);
    if (st.length) gruende.push(`Mehr als ${ziel.spieler.name} in: ${st.join(", ")}.`);
    gruende.push(`99-Regel erfüllt: Sprint ${k.skills.sprint!.wert}, Ausdauer ${k.skills.ausdauer!.wert}.`);
    gruende.push(
      rahmen.kapital !== undefined
        ? `Mindestpreis laut Markt ${eur(preis)}, dein Kapital ${eur(rahmen.kapital)}.`
        : `Mindestpreis laut Markt ${eur(preis)}.`,
    );
    gruende.push(
      !auslaender
        ? `Einheimisch (${k.nationalitaet}): belegt keinen Ausländerplatz.`
        : bewilligungNoetig
          ? `Nicht einheimisch (${k.nationalitaet}): kein Ausländerplatz frei, aber noch ${rahmen.bewilligungenFrei} Arbeitsbewilligung(en).`
          : `Nicht einheimisch (${k.nationalitaet}): belegt einen deiner ${rahmen.auslaenderFrei} freien Ausländerplätze.`,
    );

    const vorbehalte = ["Marktwert ist kein Preismaßstab: der Endpreis der Auktion kann deutlich höher liegen."];
    if (bewilligungNoetig) {
      vorbehalte.push("Arbeitsbewilligung nötig: ihre Kosten kommen zum Gebot dazu. Der Betrag steht im Gebotsfenster von ManagerZone.");
    }
    if (rahmen.kapital === undefined) vorbehalte.push("Kapital nicht eingetragen: Budget nicht geprüft.");
    if (k.alter !== undefined && k.alter >= ALTER_ABBAU) vorbehalte.push(`${k.alter} Jahre: ab 30 baut erst Sprint, dann Ausdauer ab.`);
    if (k.markt.ende) vorbehalte.push(`Auktionsende laut Seite: ${k.markt.ende}.`);
    const gemaxt = FORMEL_SKILLS.filter((s) => GEWICHTE[ziel.rolle][s] > 0 && k.skills[s]?.gemaxt === false);
    if (gemaxt.length) gruende.push(`In dieser Rolle noch trainierbar: ${gemaxt.map((s) => SKILL_LABEL[s]).join(", ")}.`);

    return { kandidat: k, ziel, neu, gewinn, preis, elfVorher: r2(elfVorher), elfNachher: r2(elfNachher), gruende, vorbehalte };
  });

  const sortiert = bewertet
    .filter((b): b is Bewertung => b !== null)
    .sort((a, b) => b.gewinn - a.gewinn || a.preis - b.preis);
  return { empfehlung: sortiert[0] ?? null, weitere: sortiert.slice(1, 6), ausgeschlossen, geprueft: kandidaten.length };
}
