// Rolle eines Spielers für die Wechselmuster, aus seiner Startposition in Editor-Koordinaten
// (Vorgabe Marcus, 25.10.2026). Reihenfolge der Prüfung wie angegeben:
//   Eckstürmer        y ≤ 80 und (x ≤ 25 oder x ≥ 185)
//   Mittelstürmer     y ≤ 110
//   Außenverteidiger  y ≥ 205 und (x ≤ 45 oder x ≥ 165)
//   Innenverteidiger  y ≥ 205 (übrige Abwehr)
//   Mittelfeld        alles dazwischen
export const ROLLEN = ["Torwart", "Eckstürmer", "Mittelstürmer", "Mittelfeld", "Außenverteidiger", "Innenverteidiger"] as const;
export type Rolle = (typeof ROLLEN)[number];

// Rolle eines Platzes (TW, VT, MF, Sturm, außen)
export function musterRolle(p: { x: number; y: number }, torwart = false): Rolle {
  if (torwart) return "Torwart";
  if (p.y <= 80 && (p.x <= 25 || p.x >= 185)) return "Eckstürmer";
  if (p.y <= 110) return "Mittelstürmer";
  if (p.y >= 205) return p.x <= 45 || p.x >= 165 ? "Außenverteidiger" : "Innenverteidiger";
  return "Mittelfeld";
}
