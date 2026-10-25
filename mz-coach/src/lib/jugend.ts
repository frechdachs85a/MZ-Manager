import type { KaderEintrag } from "@/lib/db/kader";
import { alleMzWerte, POSITIONEN } from "@/lib/mz/formel";

// Jugendregeln von Marcus (mz-wissen.md, Abschnitt 7): Nr. 100 bis 110 sind die Talente. Ab Nr. 195 nach
// und nach ersetzen (dienstags 3 neue losen). Nur Scout-Einstufung Elitespieler (4/1) oder Spitzenklasse (4/2).
export const TALENTE = { von: 100, bis: 110 };
export const ERSETZEN_AB = 195;

// Einstufung aus den Scout-Sternen Hoch/Niedrig, Wortlaut aus mz-wissen.md, Abschnitt 7
const EINSTUFUNG: Record<string, string> = {
  "4/2": "Spitzenklasse",
  "4/1": "Elitespieler",
  "3/2": "Spitzenspieler",
  "3/1": "Schlüsselfähigkeiten",
  "2/2": "keine Hauptstärken",
  "2/1": "kein Platz im Kader",
};

export type JugendSpieler = {
  s: KaderEintrag;
  einstufung?: string;
  sterne?: string;
  regelOk?: boolean; // 4/1 oder 4/2
  besterWert?: { p: string; wert: number };
};

export function jugendAuswertung(kader: KaderEintrag[]) {
  const mit = (s: KaderEintrag): JugendSpieler => {
    const st = s.scoutSterne;
    const sterne = st?.hoch !== undefined && st?.niedrig !== undefined ? `${st.hoch}/${st.niedrig}` : undefined;
    const werte = alleMzWerte(s.skills);
    const beste = POSITIONEN.flatMap((p) => (werte[p].ok ? [{ p, wert: werte[p].wert }] : [])).sort((a, b) => b.wert - a.wert)[0];
    return { s, sterne, einstufung: sterne ? EINSTUFUNG[sterne] : undefined, regelOk: sterne ? st!.hoch === 4 && (st!.niedrig === 1 || st!.niedrig === 2) : undefined, besterWert: beste };
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
        (a.s.scoutSterne?.hoch ?? 0) - (b.s.scoutSterne?.hoch ?? 0) ||
        (a.s.scoutSterne?.niedrig ?? 0) - (b.s.scoutSterne?.niedrig ?? 0) ||
        (a.s.scoutTraining ?? 0) - (b.s.scoutTraining ?? 0),
    );
  const weitere = kader.filter((s) => (s.alter ?? 99) <= 21 && nr(s) > TALENTE.bis && nr(s) < ERSETZEN_AB).map(mit);
  return { talente, ersetzen, weitere };
}
