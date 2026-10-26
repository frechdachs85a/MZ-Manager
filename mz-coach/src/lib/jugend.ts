import type { KaderEintrag } from "@/lib/db/kader";
import { alleMzWerte, POSITIONEN } from "@/lib/mz/formel";
import { KOMBIS, scoutEinstufung, type Kombi, type ScoutEinstufung } from "@/lib/scout";

// Jugendregeln von Marcus (mz-wissen.md, Abschnitt 7): Nr. 100 bis 110 sind die Talente. Ab Nr. 195 nach
// und nach ersetzen (dienstags 3 neue losen). Nur Scout-Rang 1 bis 3 (Spitzenklasse 4/2, Elite 4/1, Spitzenspieler 3/2) behalten.
export const TALENTE = { von: 100, bis: 110 };
export const ERSETZEN_AB = 195;
// Bis zu diesem Scout-Rang behalten (Marcus, 25.10.2026: Rang 1 bis 3)
export const BEHALTEN_BIS_RANG = 3;

// Vorschlag nach der Jugendregel (Marcus, 25.10.2026): nur Rang 1 bis 3 aus dem Scoutbericht behalten, alle
// anderen sind Abgabekandidaten. Loyale Spieler können nicht verkauft werden, nur entlassen.
export type Vorschlag = "behalten" | "behalten, Text fehlt" | "prüfen" | "Abgabekandidat" | "loyal" | "kein Scoutbericht";

export type JugendSpieler = {
  s: KaderEintrag;
  scout: ScoutEinstufung;
  einstufung?: string;
  sterne?: string;
  regelOk?: boolean; // Rang 1 bis 3
  vorschlag: Vorschlag;
  besterWert?: { p: string; wert: number };
};

function vorschlagAus(e: ScoutEinstufung): Vorschlag {
  if (e.status === "loyal") return "loyal";
  if (e.status === "keiner") return "kein Scoutbericht";
  if (e.status === "unbekannt") return "prüfen";
  if (e.rang! <= BEHALTEN_BIS_RANG) return e.status === "ok" ? "behalten" : "behalten, Text fehlt";
  return "Abgabekandidat";
}

// Jugendspieler einstufen und Vorschlag je Spieler
export function jugendAuswertung(kader: KaderEintrag[], kombis: Kombi[] = KOMBIS) {
  const mit = (s: KaderEintrag): JugendSpieler => {
    const scout = scoutEinstufung(s, kombis);
    const werte = alleMzWerte(s.skills);
    const beste = POSITIONEN.flatMap((p) => (werte[p].ok ? [{ p, wert: werte[p].wert }] : [])).sort((a, b) => b.wert - a.wert)[0];
    const regelOk = scout.rang !== undefined && scout.status !== "unbekannt" ? scout.rang <= BEHALTEN_BIS_RANG : undefined;
    return { s, scout, sterne: scout.sterne, einstufung: scout.status === "unbekannt" ? "Scoutbericht unbekannt" : scout.abzeichen, regelOk, vorschlag: vorschlagAus(scout), besterWert: beste };
  };
  const nr = (s: KaderEintrag) => s.nr ?? 0;
  const talente = kader.filter((s) => nr(s) >= TALENTE.von && nr(s) <= TALENTE.bis).map(mit);
  // Reihenfolge zum Ersetzen: wer die Regel nicht erfüllt, schwächste Einstufung zuerst, dann wenig Trainingssterne
  const ersetzen = kader
    .filter((s) => nr(s) >= ERSETZEN_AB)
    .map(mit)
    .sort(
      (a, b) =>
        Number(a.regelOk ?? false) - Number(b.regelOk ?? false) ||
        (b.scout.rang ?? 99) - (a.scout.rang ?? 99) ||
        (a.s.scoutTraining ?? 0) - (b.s.scoutTraining ?? 0),
    );
  const weitere = kader.filter((s) => (s.alter ?? 99) <= 21 && nr(s) > TALENTE.bis && nr(s) < ERSETZEN_AB).map(mit);
  return { talente, ersetzen, weitere };
}
