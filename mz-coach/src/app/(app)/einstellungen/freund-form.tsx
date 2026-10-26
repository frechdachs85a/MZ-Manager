"use client";

// Formular für das befreundete Team (Einladungen für Freundschaftsspiele, gesperrt für Transfers).

import { useActionState } from "react";
import { freundTeamSpeichern, type FreundState } from "./actions";

// Formular: befreundetes Team
export function FreundForm({ tid, taktik }: { tid?: number; taktik?: string }) {
  const [state, action, pending] = useActionState<FreundState, FormData>(freundTeamSpeichern, {});
  return (
    <form action={action}>
      <div className="karte overflow-hidden rounded-[18px] bg-card">
        <label className="flex min-h-11 items-center gap-3 border-b border-separator px-4">
          <span className="w-40 shrink-0 text-[15px]">Team-ID (tid)</span>
          <input name="tid" inputMode="numeric" required defaultValue={tid ?? ""} placeholder="aus ?p=team&tid=…" className="min-w-0 flex-1 bg-transparent py-3 text-right text-[17px] tabular-nums outline-none placeholder:text-label-3" />
        </label>
        <label className="flex min-h-11 items-center gap-3 px-4">
          <span className="w-40 shrink-0 text-[15px]">Taktik-Reiter</span>
          <input name="taktik" required defaultValue={taktik ?? "freund"} className="min-w-0 flex-1 bg-transparent py-3 text-right text-[17px] outline-none" />
        </label>
      </div>
      {state.meldung && <p role="status" className={`mt-2 px-4 text-[13px] ${state.ok ? "text-green" : "text-red"}`}>{state.meldung}</p>}
      <button type="submit" disabled={pending} className="pressable mt-3 min-h-[50px] w-full knopf text-[17px] font-bold disabled:opacity-50">
        {pending ? "Speichern …" : "Speichern"}
      </button>
    </form>
  );
}
