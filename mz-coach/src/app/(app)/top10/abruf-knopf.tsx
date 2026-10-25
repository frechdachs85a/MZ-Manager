"use client";

import { useActionState } from "react";
import { topJetztAbrufen, type TopState } from "./actions";

export function TopAbrufKnopf() {
  const [state, action, pending] = useActionState<TopState>(topJetztAbrufen, {});
  return (
    <form action={action}>
      <button disabled={pending} className="pressable knopf min-h-[46px] px-6 text-[15px] font-medium disabled:opacity-50">
        {pending ? "Abruf läuft (kann einige Minuten dauern) …" : "Top 10 jetzt abrufen"}
      </button>
      {state.meldung && <p role="status" className={`mt-2 text-[13px] ${state.ok ? "text-green" : "text-red"}`}>{state.meldung}</p>}
    </form>
  );
}
