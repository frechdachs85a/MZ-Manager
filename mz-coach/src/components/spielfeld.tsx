import { useId } from "react";
import { ABWEHR_Y } from "@/lib/mz/analyse/gegner";

// Spielfeld in Editor-Koordinaten. Grenzen aus der Umrechnung in mz-wissen.md, Abschnitt 3:
// origin-x 0..750 -> Editor-x 8,4..200; origin-y 0..1000 -> Editor-y 318 (eigenes Tor) .. 8.
// Schematisch: Strafräume sind im Editor nicht vermessen und werden nicht gezeichnet.

export const FELD = { x0: 8.4, x1: 200, y0: 8, y1: 318, mitte: 163 } as const;

// zusatz: zweite Zeile unter dem Namen. wert: Marktwert für die Heatmap und den Tooltip
export type FeldSpieler = { x: number; y: number; label: string; zusatz?: string; wert?: number; ton?: "normal" | "rot" | "grau"; torwart?: boolean };

// Heatmap (Marcus, 26.10.2026): Ampel-Verlauf mit FESTEN Wertgrenzen, für alle Teams gleich. Damit ist jedes Feld
// mit jedem vergleichbar: nur Grün = leichter Gegner, viel Dunkelrot = heftiger Gegner. Grenzen: ab 1,5 Mio maximal
// (dunkelrot), bis 0,7 Mio grün (Marcus' Beispiele); 0,3 / 1,0 / 1,25 Mio dazwischen gleichmäßig gesetzt.
// Der farbige Ring je Spieler trägt die Farbe, weil Grün als Schein auf dem Rasen kaum zu sehen ist.
export const WERT_STUFEN: { wert: number; farbe: [number, number, number]; name: string }[] = [
  { wert: 300_000, farbe: [187, 247, 208], name: "hellgrün" },
  { wert: 700_000, farbe: [21, 128, 61], name: "dunkelgrün" },
  { wert: 1_000_000, farbe: [250, 204, 21], name: "gelb" },
  { wert: 1_250_000, farbe: [239, 68, 68], name: "rot" },
  { wert: 1_500_000, farbe: [127, 29, 29], name: "dunkelrot" },
];
const rgb = (f: [number, number, number]) => `rgb(${f.join(" ")})`;
// Heatmap-Farbe eines Marktwerts (fest, linear zwischen den Stufen)
export function heatFarbe(wert: number): string {
  const st = WERT_STUFEN;
  if (wert <= st[0].wert) return rgb(st[0].farbe);
  for (let i = 1; i < st.length; i++) {
    if (wert <= st[i].wert) {
      const f = (wert - st[i - 1].wert) / (st[i].wert - st[i - 1].wert);
      return rgb(st[i - 1].farbe.map((v, j) => Math.round(v + (st[i].farbe[j] - v) * f)) as [number, number, number]);
    }
  }
  return rgb(st.at(-1)!.farbe);
}
const mioText = (n: number) => `${(n / 1_000_000).toFixed(n % 100_000 ? 2 : 1).replace(".", ",")}`;

const STREIFEN = 10;

// Heatmap erscheint automatisch, sobald Marktwerte da sind (Marcus, 26.10.2026: überall, immer)
export function Spielfeld({ spieler, titel, heatmap }: { spieler: FeldSpieler[]; titel?: string; heatmap?: boolean }) {
  const zeigen = heatmap ?? spieler.some((p) => p.wert !== undefined && !p.torwart);
  const sk = zeigen && spieler.some((p) => p.wert !== undefined && !p.torwart);
  const id = useId().replace(/:/g, "");
  const rand = 24; // Platz für Namen am Rand (Eckstürmer x 200)
  const randUnten = spieler.some((p) => p.zusatz) ? 34 : rand; // zweite Zeile unter dem Torwart
  const w = FELD.x1 - FELD.x0;
  const h = FELD.y1 - FELD.y0;
  const mx = (FELD.x0 + FELD.x1) / 2;
  const linie = "rgba(255,255,255,.7)";
  return (
    <figure className="m-0">
      <svg
        viewBox={`${FELD.x0 - rand} ${FELD.y0 - rand} ${w + 2 * rand} ${h + rand + randUnten}`}
        className="block w-full rounded-[10px]"
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
        <rect x={FELD.x0 - rand} y={FELD.y0 - rand} width={w + 2 * rand} height={h + rand + randUnten} fill={`url(#rasen-${id})`} />
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
        {/* Zonen: vorderste Linie y 63, Sturm bis y 110 (mz-wissen.md, Abschnitt 4), Abwehr ab y 215
            (belegt am Spielbericht Sydney FC, siehe ABWEHR_Y) */}
        <g stroke="rgba(255,255,255,.32)" strokeDasharray="3 3" strokeWidth="0.8">
          <line x1={FELD.x0} y1={110} x2={FELD.x1} y2={110} />
          <line x1={FELD.x0} y1={63} x2={FELD.x1} y2={63} />
        </g>
        <line x1={FELD.x0} y1={ABWEHR_Y} x2={FELD.x1} y2={ABWEHR_Y} stroke="rgba(255,255,255,.5)" strokeDasharray="5 3" strokeWidth="1" />
        <g fontSize="6" fill="rgba(255,255,255,.6)" fontWeight="600" letterSpacing=".4">
          <text x={FELD.x1 - 2} y={108} textAnchor="end">STURM y 110</text>
          <text x={FELD.x1 - 2} y={61} textAnchor="end">MIN y 63</text>
          <text x={FELD.x1 - 2} y={ABWEHR_Y + 7} textAnchor="end">ABWEHR ab y {ABWEHR_Y}</text>
        </g>
        {/* Heatmap der Marktwerte: weiche Farbflächen unter den Spielern, feste Wertgrenzen */}
        {sk && (
          <g>
            <defs>
              <filter id={`weich-${id}`} x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            {spieler
              .filter((p) => p.wert !== undefined && !p.torwart)
              .map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={20} fill={heatFarbe(p.wert!)} opacity={0.6} filter={`url(#weich-${id})`} />
              ))}
          </g>
        )}
        {spieler.map((s, i) => {
          const farbe = s.ton === "rot" ? "var(--red)" : s.ton === "grau" ? "rgba(255,255,255,.4)" : s.torwart ? "var(--yellow)" : "#fff";
          const breite = Math.max(14, Math.max(s.label.length * 4.6, (s.zusatz?.length ?? 0) * 4.2) + 6);
          return (
            <g key={i} transform={`translate(${s.x} ${s.y})`}>
              <title>{`${s.label}${s.zusatz ? ` · ${s.zusatz}` : ""}${s.wert !== undefined ? ` · ${new Intl.NumberFormat("de-DE").format(s.wert)} €` : ""}${s.torwart ? " (Torwart)" : ""} · x ${s.x} / y ${s.y}`}</title>
              <circle r={8} fill={farbe} stroke="rgba(0,0,0,.18)" strokeWidth="0.8" filter={`url(#schatten-${id})`} />
              <circle r={8} fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="1" opacity={s.ton === "grau" ? 0 : 0.5} />
              {sk && s.wert !== undefined && !s.torwart && (
                <>
                  <circle r={11.4} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="1" />
                  <circle r={10.2} fill="none" stroke={heatFarbe(s.wert)} strokeWidth="3" />
                </>
              )}
              <rect x={-breite / 2} y={10.5} width={breite} height={s.zusatz ? 18 : 10} rx={5} fill="rgba(0,0,0,.5)" />
              <text y={17.8} textAnchor="middle" fontSize="7.2" fill="#fff" fontWeight="600">
                {s.label}
              </text>
              {s.zusatz && (
                <text y={25.6} textAnchor="middle" fontSize="6.4" fill="#d1fae5" fontWeight="600">
                  {s.zusatz}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {sk && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11.5px] text-label-2">
          <span className="whitespace-nowrap">Marktwert (Mio, fest für alle Teams)</span>
          {WERT_STUFEN.map((st, k) => (
            <span key={st.wert} className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: rgb(st.farbe) }} />
              {k === 0 ? `≤ ${mioText(st.wert)}` : k === WERT_STUFEN.length - 1 ? `≥ ${mioText(st.wert)}` : mioText(st.wert)}
            </span>
          ))}
        </div>
      )}
      {titel && <figcaption className="mt-2 text-center text-[13px] font-medium text-label-2">{titel}</figcaption>}
    </figure>
  );
}
