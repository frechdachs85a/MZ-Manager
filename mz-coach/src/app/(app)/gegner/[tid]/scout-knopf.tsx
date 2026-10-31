"use client";

// Knopf „Scoutspiele auswerten“ auf der Gegnerseite (Marcus, 31.10.2026)

import { useActionState } from "react";
import { scoutspieleAuswerten, type HolState } from "./actions";

export function ScoutKnopf({ tid, text = "Alle Scoutspiele gegen ihn auswerten" }: { tid: number; text?: string }) {
  const [state, action, pending] = useActionState<HolState>(() => scoutspieleAuswerten(tid), {});
  return (
    <form action={action}>
      <button type="submit" disabled={pending} className="pressable min-h-[50px] w-full knopf text-[17px] font-bold disabled:opacity-50">
        {pending ? "Hole und werte Scoutspiele aus … (je Spiel einige Sekunden)" : text}
      </button>
      {state.meldung && (
        <p role="status" className={`mt-2 px-4 text-[13px] ${state.ok ? "text-green" : "text-red"}`}>
          {state.meldung}
        </p>
      )}
    </form>
  );
}
