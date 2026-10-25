import { useId } from "react";

// Spielfeld in Editor-Koordinaten. Grenzen aus der Umrechnung in mz-wissen.md, Abschnitt 3:
// origin-x 0..750 -> Editor-x 8,4..200; origin-y 0..1000 -> Editor-y 318 (eigenes Tor) .. 8.
// Schematisch: Strafräume sind im Editor nicht vermessen und werden nicht gezeichnet.

export const FELD = { x0: 8.4, x1: 200, y0: 8, y1: 318, mitte: 163 } as const;

export type FeldSpieler = { x: number; y: number; label: string; ton?: "normal" | "rot" | "grau"; torwart?: boolean };

const STREIFEN = 10;

export function Spielfeld({ spieler, titel }: { spieler: FeldSpieler[]; titel?: string }) {
  const id = useId().replace(/:/g, "");
  const rand = 24; // Platz für Namen am Rand (Eckstürmer x 200)
  const w = FELD.x1 - FELD.x0;
  const h = FELD.y1 - FELD.y0;
  const mx = (FELD.x0 + FELD.x1) / 2;
  const linie = "rgba(255,255,255,.7)";
  return (
    <figure className="m-0">
      <svg
        viewBox={`${FELD.x0 - rand} ${FELD.y0 - rand} ${w + 2 * rand} ${h + 2 * rand}`}
        className="karte block w-full rounded-[16px]"
        role="img"
        aria-label={titel ?? "Spielfeld"}
      >
        <defs>
          <linearGradient id={`rasen-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--pitch)" />
            <stop offset="1" stopColor="var(--pitch-2)" />
          </linearGradient>
          <filter id={`schatten-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodColor="#000" floodOpacity=".35" />
          </filter>
        </defs>
        <rect x={FELD.x0 - rand} y={FELD.y0 - rand} width={w + 2 * rand} height={h + 2 * rand} fill={`url(#rasen-${id})`} />
        {/* Mähstreifen, rein optisch */}
        {Array.from({ length: STREIFEN }, (_, i) =>
          i % 2 ? null : (
            <rect key={i} x={FELD.x0} y={FELD.y0 + (i * h) / STREIFEN} width={w} height={h / STREIFEN} fill="rgba(255,255,255,.045)" />
          ),
        )}
        <g fill="none" stroke={linie} strokeWidth="1.2">
          <rect x={FELD.x0} y={FELD.y0} width={w} height={h} rx="1.5" />
          <line x1={FELD.x0} y1={FELD.mitte} x2={FELD.x1} y2={FELD.mitte} />
          <circle cx={mx} cy={FELD.mitte} r={2} fill={linie} />
        </g>
        {/* Tore: Gegner oben, eigenes Tor unten. Nur Lage, Breite schematisch. */}
        <g fill="rgba(255,255,255,.85)">
          <rect x={mx - 14} y={FELD.y0 - 3.5} width={28} height={3} rx="1.5" />
          <rect x={mx - 14} y={FELD.y1 + 0.5} width={28} height={3} rx="1.5" />
        </g>
        {/* Sturm-Grenze y 110 und vorderste Linie y 63 (mz-wissen.md, Abschnitt 4) */}
        <g stroke="rgba(255,255,255,.32)" strokeDasharray="3 3" strokeWidth="0.8">
          <line x1={FELD.x0} y1={110} x2={FELD.x1} y2={110} />
          <line x1={FELD.x0} y1={63} x2={FELD.x1} y2={63} />
        </g>
        <g fontSize="6" fill="rgba(255,255,255,.55)" fontWeight="600" letterSpacing=".4">
          <text x={FELD.x1 - 2} y={108} textAnchor="end">STURM y 110</text>
          <text x={FELD.x1 - 2} y={61} textAnchor="end">MIN y 63</text>
        </g>
        {spieler.map((s, i) => {
          const farbe = s.ton === "rot" ? "var(--red)" : s.ton === "grau" ? "rgba(255,255,255,.4)" : s.torwart ? "var(--yellow)" : "#fff";
          const breite = Math.max(14, s.label.length * 4.6 + 6);
          return (
            <g key={i} transform={`translate(${s.x} ${s.y})`}>
              <title>{`${s.label}${s.torwart ? " (Torwart)" : ""} · x ${s.x} / y ${s.y}`}</title>
              <circle r={8} fill={farbe} stroke="rgba(0,0,0,.18)" strokeWidth="0.8" filter={`url(#schatten-${id})`} />
              <circle r={8} fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="1" opacity={s.ton === "grau" ? 0 : 0.5} />
              <rect x={-breite / 2} y={10.5} width={breite} height={10} rx={5} fill="rgba(0,0,0,.42)" />
              <text y={17.8} textAnchor="middle" fontSize="7.2" fill="#fff" fontWeight="600">
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
      {titel && <figcaption className="mt-2 text-center text-[13px] font-medium text-label-2">{titel}</figcaption>}
    </figure>
  );
}
