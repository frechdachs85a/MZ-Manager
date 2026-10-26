// Wann die Spieltag-Automatik nach einem Ligaspiel läuft (Marcus, 26.10.2026: 5 Stunden nach dem Ligaspiel).
// Spielende = Anstoß plus gemessene Spieldauer (Stats-XML von Spiel 1625669278: 14:45 bis 16:19, 94 Minuten).
export const SPIELDAUER_MIN = 95;
export const NACH_SPIEL_H = 5;

// Ab wann die Spieltag-Auswertung fällig ist (Anstoß + 95 Min. + 5 Std.)
export function faelligAb(anstossIso: string): Date {
  return new Date(new Date(anstossIso).getTime() + (SPIELDAUER_MIN + NACH_SPIEL_H * 60) * 60_000);
}
