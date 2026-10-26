import type { MarktSpieler } from "@/lib/mz/parser/transfer";

// Eckdaten eines Spielers auf dem Transfermarkt, überall gleich (Marcus, 26.10.2026): Alter, Nationalität, Wert,
// Startgebot (Mindestgebot ohne Vorgebot), aktuelles Gebot, Auktionsende. "stand" sagt, woher die Zahlen sind
// (z. B. Marktsuche oder Laden), weil sich Gebot und Ende bis zur Auktion ändern können.

const eur = (n?: number) => (n === undefined ? "–" : `${new Intl.NumberFormat("de-DE").format(n)} €`);
// "26-10-2026 18:38" (ManagerZone) -> "26.10.2026 18:38"
const ende = (s?: string) => (s ? s.replace(/^(\d{2})-(\d{2})-(\d{4})/, "$1.$2.$3") : "–");

function Feld({ titel, wert, stark }: { titel: string; wert: string; stark?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-label-3">{titel}</div>
      <div className={`tabular-nums ${stark ? "text-[15px] font-bold text-label" : "text-[13.5px] font-semibold"}`}>{wert}</div>
    </div>
  );
}

export function MarktInfo({ s, stand, hell = false }: { s: MarktSpieler; stand?: string; hell?: boolean }) {
  const gebot = s.markt.hoechstgebot;
  return (
    <div className={hell ? "text-white [&_.text-label]:text-white [&_.text-label-3]:text-white/70" : ""}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        <Feld titel="Alter" wert={s.alter !== undefined ? `${s.alter} Jahre` : "–"} />
        <Feld titel="Nationalität" wert={s.nationalitaet ?? "–"} />
        <Feld titel="Wert" wert={eur(s.wert)} />
        <Feld titel="Startgebot" wert={eur(s.markt.gefordert)} />
        <Feld titel="Aktuelles Gebot" wert={gebot ? eur(gebot) : "noch keins"} stark />
        <Feld titel="Auktionsende" wert={ende(s.markt.ende)} stark />
      </div>
      {stand && <div className={`mt-1.5 text-[11px] ${hell ? "text-white/60" : "text-label-3"}`}>{stand}</div>}
    </div>
  );
}
