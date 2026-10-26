import type { ElfWert } from "@/lib/kaderwert";

const eur = (n: number) => `${new Intl.NumberFormat("de-DE").format(Math.round(n))} €`;

// Startelf-Wert unter dem Teamnamen (Marcus, 26.10.2026: der Teamwert der Startelf ist entscheidend)
export function ElfWertZeile({ w, rechts = false }: { w: (ElfWert & { stand?: string }) | null | undefined; rechts?: boolean }) {
  if (!w) return <span className={`mt-1 block font-sans text-[12.5px] font-medium normal-case text-label-3 ${rechts ? "text-right" : ""}`}>Startelf-Wert n. v. (Kaderseite nicht gelesen)</span>;
  return (
    <span className={`mt-1 block font-sans normal-case ${rechts ? "text-right" : ""}`}>
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-label-3">Startelf-Wert</span>
      <span className="block text-[17px] font-bold tabular-nums text-label">{eur(w.summe)}</span>
      {w.mitWert < w.spieler && <span className="block text-[11.5px] font-medium text-label-3">{w.mitWert} von {w.spieler} Spielern mit Wert</span>}
    </span>
  );
}
