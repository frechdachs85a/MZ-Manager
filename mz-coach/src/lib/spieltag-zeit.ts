// Wann die Spieltag-Automatik nach einem Ligaspiel läuft (Marcus, 01.11.2026: 3 Stunden nach dem Ligaspiel statt 5 Stunden
// nach Spielende). Gezählt ab Anstoß; das Spiel selbst dauert etwa 95 Minuten (Stats-XML von Spiel 1625669278: 14:45 bis
// 16:19), danach sind Ergebnis, Stats-XML und Tabelle da.
export const SPIELDAUER_MIN = 95;
export const NACH_SPIEL_H = 3;

// Ab wann die Spieltag-Auswertung fällig ist (Anstoß + 3 Std.)
export function faelligAb(anstossIso: string): Date {
  return new Date(new Date(anstossIso).getTime() + NACH_SPIEL_H * 3600_000);
}
