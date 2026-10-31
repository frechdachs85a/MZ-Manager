// Anzeige des Teamwerts (nach Spielzeit gewichtet, Marcus 30.10.2026) und des prozentualen Unterschieds zum Gegner.

import type { ElfWert } from "@/lib/kaderwert";

const eur = (n: number) => `${new Intl.NumberFormat("de-DE").format(Math.round(n))} €`;

// Teamwert unter dem Teamnamen: ein Wert, jeder Spieler anteilig nach seinen Spielminuten
export function ElfWertZeile({ w, rechts = false }: { w: (ElfWert & { stand?: string }) | null | undefined; rechts?: boolean }) {
  if (!w)
    return (
      <span className={`mt-1 block font-sans text-[12.5px] font-medium normal-case text-label-3 ${rechts ? "text-right" : ""}`}>
        Teamwert n. v. (Kaderseite nicht gelesen)
      </span>
    );
  return (
    <span className={`mt-1 block font-sans normal-case ${rechts ? "text-right" : ""}`}>
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-label-3">Teamwert</span>
      <span className="block text-[17px] font-bold tabular-nums text-label">{eur(w.summe)}</span>
      {w.mitWert < w.spieler && (
        <span className="block text-[11.5px] font-medium text-label-3">
          {w.mitWert} von {w.spieler} Startspielern mit Wert
        </span>
      )}
    </span>
  );
}

// Unterschied der Teamwerte aus deiner Sicht: "+9 %" heißt, dein Team ist 9 % mehr wert als seins
export function wertUnterschied(eigen?: number, gegner?: number): number | undefined {
  return eigen && gegner ? Math.round((eigen / gegner - 1) * 100) : undefined;
}

// Prozentualer Unterschied der Teamwerte (+ = du hast mehr Wert)
export function WertDiff({ eigen, gegner, klein = false }: { eigen?: number; gegner?: number; klein?: boolean }) {
  const d = wertUnterschied(eigen, gegner);
  if (d === undefined) return null;
  const farbe = d > 0 ? "bg-[#0b6b3f] text-white" : d < 0 ? "bg-[#b42318] text-white" : "bg-white/15 text-label";
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-[6px] px-2 py-0.5 font-sans normal-case ${farbe} ${klein ? "text-[12.5px]" : "text-[14px]"}`}
      title="Teamwert: deiner im Vergleich zu seinem"
    >
      <span className="font-bold tabular-nums">{d > 0 ? `+${d}` : d} %</span>
      <span className="opacity-90">Teamwert {d > 0 ? "für dich" : d < 0 ? "für ihn" : "gleich"}</span>
    </span>
  );
}
