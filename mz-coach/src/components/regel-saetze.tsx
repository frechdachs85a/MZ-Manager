import type { RegelSatz } from "@/lib/mz/analyse/muster";

const MARKE: Record<RegelSatz["art"], string> = { wechsel: "Wechsel", taktik: "Taktik", keine: "Keine Regel", info: "Hinweis" };

// Regelmuster als Sätze, darunter was aus der XML nicht erkennbar ist
export function RegelSaetze({ regeln }: { regeln: RegelSatz[] }) {
  return (
    <div>
      <div className="text-label-2">Regelmuster aus allen Spielen:</div>
      {regeln.length ? (
        <ul className="mt-1 space-y-1">
          {regeln.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-24 shrink-0 text-[12px] uppercase tracking-wide text-label-3">{MARKE[r.art]}</span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-label-3">Keine Regel ausgelöst.</div>
      )}
      <div className="mt-1.5 text-[12px] text-label-3">
        Nur ausgelöste Regeln stehen in der XML. Rolle des Ausgewechselten aus seiner Startposition; der Einwechsler übernimmt dessen Platz (abgeleitet).
        Eine Umstellung der Formation im Spiel ist nicht erkennbar.
      </div>
    </div>
  );
}
