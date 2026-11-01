import Link from "next/link";

// Reiter des Transfermarkts (Marcus, 31.10.2026): Vorschläge, Watchlist, Gebote; „Spieler eintragen“ ganz vorne als eigener
// Reiter (Marcus, 01.11.2026)
const REITER = [
  { href: "/markt/eintragen", label: "+ Spieler eintragen" },
  { href: "/markt", label: "Vorschläge" },
  { href: "/markt/watchlist", label: "Watchlist" },
  { href: "/markt/bietomat", label: "Gebote" },
] as const;

export function MarktReiter({ aktiv, anzahl = {} }: { aktiv: (typeof REITER)[number]["href"]; anzahl?: Partial<Record<(typeof REITER)[number]["href"], number>> }) {
  return (
    <nav className="seite mt-4 flex gap-1 overflow-x-auto border-b border-separator whitespace-nowrap" aria-label="Transfermarkt">
      {REITER.map((r) => (
        <Link
          key={r.href}
          href={r.href}
          className={`-mb-px rounded-t-md border-b-2 px-4 py-2 text-[15px] font-semibold ${
            r.href === aktiv ? "border-tint text-tint" : "border-transparent text-label-2 hover:text-label"
          }`}
        >
          {r.label}
          {anzahl[r.href] !== undefined && <span className="ml-1.5 rounded-full bg-fill px-1.5 text-[12px] tabular-nums text-label-2">{anzahl[r.href]}</span>}
        </Link>
      ))}
    </nav>
  );
}
