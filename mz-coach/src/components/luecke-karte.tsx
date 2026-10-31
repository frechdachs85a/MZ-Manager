"use client";

// Fehlender bewährter Top-10-Stil gegen den nächsten Ligagegner (Marcus, 31.10.2026): Reiter wählen, mit Rückfrage
// in ManagerZone schreiben und nach dem Inhalt benennen. Nur auf Klick.

import { useActionState } from "react";
import { DateiKnopf } from "@/components/datei-knopf";
import { FortschrittBalken } from "@/components/fortschritt-balken";
import { lueckeUebernehmenAktion, type UebernahmeState } from "@/app/(app)/taktik-check-actions";

export function LueckeKarte({ name, xml, reiter }: { name: string; xml: string; reiter: { name: string; fest: boolean; leer: boolean }[] }) {
  const [state, action, pending] = useActionState<UebernahmeState, FormData>(lueckeUebernehmenAktion, {});
  return (
    <div>
      <form
        action={action}
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          const r = String(new FormData(e.currentTarget).get("reiter") ?? "");
          const leer = reiter.find((x) => x.name === r)?.leer;
          if (!confirm(`Neue Taktik in den Reiter „${r}“ schreiben und in „${name}“ umbenennen?${leer ? "" : " Die bisherige Taktik in diesem Reiter geht verloren."}`))
            e.preventDefault();
        }}
      >
        <label className="text-[13px] text-label-2" htmlFor="luecke-reiter">
          In Reiter:
        </label>
        <select id="luecke-reiter" name="reiter" className="rounded-md border border-separator bg-white px-2 py-1 text-[13px]" defaultValue={reiter[0]?.name}>
          {reiter.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name}
              {r.leer ? " (leer)" : r.fest ? " (Stammtaktik)" : ""}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending || !reiter.length} className="pressable rounded-md bg-tint px-3 py-1.5 text-[13px] font-semibold text-auf-akzent disabled:opacity-50">
          {pending ? "Wird übernommen …" : `Als „${name}“ übernehmen`}
        </button>
        <DateiKnopf text={xml} dateiname={`${name}.xml`.replace(/[^\w.-]+/g, "_")} label="XML" />
      </form>
      <FortschrittBalken aktiv={pending} />
      {state.meldung && <p className={`mt-1 text-[12.5px] ${state.ok ? "text-green" : "text-red"}`}>{state.meldung}</p>}
    </div>
  );
}
