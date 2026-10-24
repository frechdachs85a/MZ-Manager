// Umrechnung origin (Stats-XML) in Taktik-Editor-Koordinaten, mz-wissen.md Abschnitt 3.
// - Torwart des Teams bei origin-y = 1000: d = 1000 − y, x unverändert
// - Torwart des Teams bei origin-y = 0:    d = y, x vorher spiegeln: x' = 750 − x
// - Editor-x = 0,2555 × x + 8,4
// - Editor-y = 318 − 0,31 × d (mindestens 63)

export type Punkt = { x: number; y: number };

export const EDITOR_Y_MIN = 63;

export function originZuEditor(origin: Punkt, torwartOriginY: 0 | 1000): Punkt {
  const d = torwartOriginY === 1000 ? 1000 - origin.y : origin.y;
  const x = torwartOriginY === 1000 ? origin.x : 750 - origin.x;
  return {
    x: Math.round(0.2555 * x + 8.4),
    y: Math.round(Math.max(EDITOR_Y_MIN, 318 - 0.31 * d)),
  };
}

// Das genaue Format des origin-Attributs wird erst am echten XML festgelegt (Etappe 3).
