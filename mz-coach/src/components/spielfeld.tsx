// Spielfeld in Editor-Koordinaten. Grenzen aus der Umrechnung in mz-wissen.md, Abschnitt 3:
// origin-x 0..750 -> Editor-x 8,4..200; origin-y 0..1000 -> Editor-y 318 (eigenes Tor) .. 8.
// Schematisch: Strafräume sind im Editor nicht vermessen und werden nicht gezeichnet.

export const FELD = { x0: 8.4, x1: 200, y0: 8, y1: 318, mitte: 163 } as const;

export type FeldSpieler = { x: number; y: number; label: string; ton?: "normal" | "rot" | "grau"; torwart?: boolean };

export function Spielfeld({ spieler, titel }: { spieler: FeldSpieler[]; titel?: string }) {
  const rand = 24; // Platz für Namen am Rand (Eckstürmer x 200)
  const w = FELD.x1 - FELD.x0;
  const h = FELD.y1 - FELD.y0;
  return (
    <figure className="m-0">
      <svg
        viewBox={`${FELD.x0 - rand} ${FELD.y0 - rand} ${w + 2 * rand} ${h + 2 * rand}`}
        className="block w-full rounded-[12px] bg-pitch"
        role="img"
        aria-label={titel ?? "Spielfeld"}
      >
        <g fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.2">
          <rect x={FELD.x0} y={FELD.y0} width={w} height={h} />
          <line x1={FELD.x0} y1={FELD.mitte} x2={FELD.x1} y2={FELD.mitte} />
          <circle cx={(FELD.x0 + FELD.x1) / 2} cy={FELD.mitte} r={2} fill="rgba(255,255,255,.55)" />
        </g>
        {/* Sturm-Grenze y 110 und vorderste Linie y 63 (mz-wissen.md, Abschnitt 4) */}
        <g stroke="rgba(255,255,255,.25)" strokeDasharray="3 3" strokeWidth="0.8">
          <line x1={FELD.x0} y1={110} x2={FELD.x1} y2={110} />
          <line x1={FELD.x0} y1={63} x2={FELD.x1} y2={63} />
        </g>
        {spieler.map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y})`}>
            <circle
              r={8}
              fill={s.ton === "rot" ? "var(--red)" : s.ton === "grau" ? "rgba(255,255,255,.35)" : s.torwart ? "var(--yellow)" : "#fff"}
              stroke="rgba(0,0,0,.25)"
              strokeWidth="0.8"
            />
            <text y={17} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="600" style={{ paintOrder: "stroke" }} stroke="rgba(0,0,0,.35)" strokeWidth="2">
              {s.label}
            </text>
          </g>
        ))}
      </svg>
      {titel && <figcaption className="mt-1 text-center text-[13px] text-label-2">{titel}</figcaption>}
    </figure>
  );
}
