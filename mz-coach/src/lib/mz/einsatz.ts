import type { SpielerDaten } from "@/lib/mz/spieler";
import { naechsterLigaspieltag } from "@/lib/wissen/startbasis";

// Einsatz fürs nächste Ligaspiel aus zwei Quellen (Idee von Marcus, 24.10.2026):
// - Taktikseite: Kegel = jetzt nicht aufstellbar (Trainingslager ohne Chip)
// - Trainingslager-Seite: Enddatum
// Ob ein Spieler am Enddatum selbst schon spielen kann, ist nicht belegt, daher "unklar".

export type Einsatz =
  | { lage: "bereit"; text: string }
  | { lage: "wieder_bereit"; text: string }
  | { lage: "nicht_bereit"; text: string; abSpieltag?: string }
  | { lage: "unklar"; text: string }
  | { lage: "unbekannt"; text: string };

// Datum als JJJJ-MM-TT ohne Zeitzonenverschiebung (Date mit lokalem Kalendertag)
export function tag(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function alsDate(t: string): Date {
  const [j, m, d] = t.split("-").map(Number);
  return new Date(j, m - 1, d);
}

// "Mi 04.11." (ohne Punkt nach dem Wochentag, damit Sätze nicht doppelt enden)
export function datumKurz(t: string): string {
  const d = alsDate(t);
  const wt = new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(d).replace(".", "");
  return `${wt} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

export function einsatzImLigaspiel(s: SpielerDaten, spieltag: Date): Einsatz {
  const st = s.status ?? {};
  const tl = s.trainingslagerInfo;
  const spiel = tag(spieltag);

  if (st.aufstellbar === undefined) {
    return { lage: "unbekannt", text: "Aufstellbarkeit nicht verfügbar: Taktikseite noch nicht eingelesen." };
  }
  if (st.aufstellbar) {
    return st.trainingslager
      ? { lage: "bereit", text: "Im Trainingslager, laut Taktikseite trotzdem aufstellbar." }
      : { lage: "bereit", text: "Laut Taktikseite aufstellbar." };
  }
  // Kegel auf der Taktikseite
  if (!st.trainingslager || !tl?.ende || !/^\d{4}-\d{2}-\d{2}$/.test(tl.ende)) {
    return { lage: "nicht_bereit", text: "Laut Taktikseite nicht aufstellbar (Kegel). Enddatum nicht verfügbar." };
  }
  const ende = datumKurz(tl.ende);
  if (tl.ende < spiel) {
    return {
      lage: "wieder_bereit",
      text: `Voraussichtlich wieder einsatzbereit: Trainingslager endet am ${ende}, vor dem Ligaspiel am ${datumKurz(spiel)}`,
    };
  }
  if (tl.ende === spiel) {
    return {
      lage: "unklar",
      text: `Unklar: Trainingslager endet am Spieltag (${ende}), ob er rechtzeitig frei ist, ist nicht belegt`,
    };
  }
  // Erstes Ligaspiel sicher nach dem Enddatum
  const danach = alsDate(tl.ende);
  danach.setDate(danach.getDate() + 1);
  const ab = tag(naechsterLigaspieltag(danach));
  return {
    lage: "nicht_bereit",
    text: `Im Trainingslager bis ${ende}${tl.verbleibendeTage !== undefined ? ` (noch ${tl.verbleibendeTage} Tage laut Seite)` : ""}, frühestens wieder am ${datumKurz(ab)}`,
    abSpieltag: ab,
  };
}
