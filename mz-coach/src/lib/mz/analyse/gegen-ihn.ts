import type { StatsSpiel } from "@/lib/mz/parser/stats";
import { de } from "./gegner";
import { gegnerKlasse, spielMuster, stilText, type Bilanz, type Ergebnis } from "./muster";

// Was gegen ein Team funktioniert hat (Auftrag Marcus, 26.10.2026): seine Gegner in den ausgewerteten
// Ligaspielen, mit deren Aufstellung und Einstellung aus derselben Stats-XML und dem Ergebnis aus
// Sicht dieser Gegner. Gruppiert nach Taktik und nach Formation. Wenige Spiele: nur Hinweise, kein Beleg.

export type GegnerSeinesSpiels = {
  mid: number;
  datum?: string;
  name: string;
  tid: number;
  stil: string; // Formation taktik/spielweise/härte
  formation: string;
  tactic?: string;
  playstyle?: string;
  aggression?: string;
  klasse: string; // Fünferkette | enge Mitte | mit Außenspielern
  ergebnis: Ergebnis; // aus Sicht des Gegners des Gegners
  seinErgebnis: Ergebnis; // aus Sicht des analysierten Teams (für die Anzeige: grün = er hat gewonnen)
  tore: { fuer: number; gegen: number };
  feld: { x: number; y: number }[]; // Startaufstellung dieses Gegners (Editor-Koordinaten)
  torwart?: { x: number; y: number };
};

export type Gruppe = { wert: string; spiele: number; bilanz: Bilanz; tore: { fuer: number; gegen: number }; quote: number };

export type GegenIhn = {
  tid: number;
  spiele: GegnerSeinesSpiels[]; // neuestes zuerst
  nachTaktik: Gruppe[];
  nachFormation: Gruppe[];
  nachStil: Gruppe[];
  saetze: string[];
};

const umkehren = (e: Ergebnis): Ergebnis => (e === "S" ? "N" : e === "N" ? "S" : "U");
// Punktquote: Sieg 1, Remis 0,5 (wie im Taktik-Portfolio)
const punkte = (b: Bilanz) => (b.S + b.U / 2) / Math.max(1, b.S + b.U + b.N);

function gruppiere(spiele: GegnerSeinesSpiels[], schluessel: (s: GegnerSeinesSpiels) => string): Gruppe[] {
  const m = new Map<string, GegnerSeinesSpiels[]>();
  for (const s of spiele) m.set(schluessel(s), [...(m.get(schluessel(s)) ?? []), s]);
  return [...m.entries()]
    .map(([wert, sp]) => {
      const bilanz = { S: sp.filter((s) => s.ergebnis === "S").length, U: sp.filter((s) => s.ergebnis === "U").length, N: sp.filter((s) => s.ergebnis === "N").length };
      return {
        wert,
        spiele: sp.length,
        bilanz,
        tore: { fuer: sp.reduce((x, s) => x + s.tore.fuer, 0), gegen: sp.reduce((x, s) => x + s.tore.gegen, 0) },
        quote: punkte(bilanz),
      };
    })
    .sort((a, b) => b.quote - a.quote || b.spiele - a.spiele);
}

const bilanzText = (b: Bilanz) => `${b.S} S / ${b.U} U / ${b.N} N`;

export function gegenIhn(tid: number, spiele: StatsSpiel[]): GegenIhn {
  const liste: GegnerSeinesSpiels[] = spiele
    .filter((s) => s.teams.some((t) => t.id === tid))
    .map((s) => {
      const m = spielMuster(s, tid, { anonym: true });
      return {
        mid: s.mid,
        datum: s.datum,
        name: m.gegner.name,
        tid: m.gegner.tid,
        stil: stilText(m.gegner),
        formation: m.gegner.formation.text,
        tactic: m.gegner.tactic,
        playstyle: m.gegner.playstyle,
        aggression: m.gegner.aggression,
        klasse: gegnerKlasse(m.gegner),
        ergebnis: umkehren(m.ergebnis),
        seinErgebnis: m.ergebnis,
        feld: m.gegner.feld,
        torwart: m.gegner.torwart,
        tore: { fuer: m.tore.gegner, gegen: m.tore.eigen },
      };
    })
    .sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? "") || b.mid - a.mid);

  const nachTaktik = gruppiere(liste, (s) => de(s.tactic ?? "?"));
  const nachFormation = gruppiere(liste, (s) => s.formation);
  const nachStil = gruppiere(liste, (s) => `${s.formation} ${de(s.tactic ?? "?")}/${de(s.playstyle ?? "?")}`);

  const saetze: string[] = [];
  const gesamt = { S: liste.filter((s) => s.ergebnis === "S").length, U: liste.filter((s) => s.ergebnis === "U").length, N: liste.filter((s) => s.ergebnis === "N").length };
  if (liste.length === 0) {
    saetze.push("Keine Ligaspiele mit Stats-XML: nichts auswertbar.");
  } else {
    saetze.push(`Seine Gegner holten in ${liste.length} Ligaspielen ${bilanzText(gesamt)} gegen ihn.`);
    const erfolgreich = liste.filter((s) => s.ergebnis !== "N");
    if (erfolgreich.length === 0) saetze.push("Keiner seiner Gegner hat gegen ihn gepunktet.");
    else
      saetze.push(
        `Gepunktet gegen ihn: ${erfolgreich
          .map((s) => `${s.name} mit ${s.formation} ${de(s.tactic ?? "?")}/${de(s.playstyle ?? "?")} (${s.ergebnis === "S" ? "Sieg" : "Remis"} ${s.tore.fuer}:${s.tore.gegen})`)
          .join("; ")}.`,
      );
    for (const g of nachTaktik) {
      saetze.push(`Gegen ihn mit ${g.wert}: ${g.spiele} ${g.spiele === 1 ? "Spiel" : "Spiele"}, ${bilanzText(g.bilanz)}, Tore ${g.tore.fuer}:${g.tore.gegen}.`);
    }
    if (liste.length < 4) saetze.push(`Nur ${liste.length} Spiele: Hinweis, kein Beleg.`);
  }
  return { tid, spiele: liste, nachTaktik, nachFormation, nachStil, saetze };
}
