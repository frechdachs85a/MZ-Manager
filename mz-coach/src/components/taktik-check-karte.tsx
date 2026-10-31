"use client";

// Ein Eintrag des Taktik-Checks auf der Zentrale: Änderungen kurz, XML zum Herunterladen, Knopf zum Übernehmen in
// ManagerZone (erst auf Klick, mit Rückfrage).

import { useActionState } from "react";
import { DateiKnopf } from "@/components/datei-knopf";
import { portfolioVorschlagUebernehmen, vorschlagUebernehmen, type UebernahmeState } from "@/app/(app)/taktik-check-actions";

// art portfolio: Reiter wird mit einem neuen Stil überschrieben (anderer Knopf-Text, andere Aktion)
export function TaktikCheckKarte({ reiter, punkte, gewinn, xml, art = "check" }: { reiter: string; punkte: string[]; gewinn: number; xml: string; art?: "check" | "portfolio" }) {
  const [state, action, pending] = useActionState<UebernahmeState, FormData>(art === "portfolio" ? portfolioVorschlagUebernehmen : vorschlagUebernehmen, {});
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold">{reiter}</span>
        {art === "check" && gewinn !== 0 && (
          <span className={`text-[12.5px] font-semibold ${gewinn > 0 ? "text-green" : "text-red"}`}>
            {gewinn > 0 ? "+" : ""}
            {gewinn.toFixed(2).replace(".", ",")} MZ-Wert in der Elf
          </span>
        )}
      </div>
      <ul className="mt-1 space-y-0.5 text-[13px] text-label-2">
        {punkte.map((p) => (
          <li key={p}>• {p}</li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DateiKnopf text={xml} dateiname={`${reiter}-angepasst.xml`.replace(/[^\w.-]+/g, "_")} label="XML" />
        <form
          action={action}
          onSubmit={(e) => {
            if (!confirm(art === "portfolio" ? `Reiter „${reiter}“ in ManagerZone mit dem neuen Stil überschreiben? Die bisherige Taktik in diesem Reiter geht verloren.` : `Vorschlag für „${reiter}“ in ManagerZone in den gleichnamigen Reiter schreiben?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="reiter" value={reiter} />
          <button type="submit" disabled={pending} className="pressable rounded-md bg-tint px-3 py-1.5 text-[13px] font-semibold text-auf-akzent disabled:opacity-50">
            {pending ? "Wird übernommen …" : art === "portfolio" ? `${reiter} überschreiben` : "In ManagerZone übernehmen"}
          </button>
        </form>
      </div>
      {state.meldung && <p className={`mt-1 text-[12.5px] ${state.ok ? "text-green" : "text-red"}`}>{state.meldung}</p>}
    </div>
  );
}
