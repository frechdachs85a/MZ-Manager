"use client";

import { useActionState } from "react";
import { haptic } from "@/lib/haptics";
import { jetztSuchen, rahmenSpeichern, type MarktState } from "./actions";

const KNOPF =
  "pressable min-h-[50px] w-full rounded-[14px] bg-tint shadow-[0_6px_16px_-6px_var(--tint)] text-[17px] font-semibold text-white disabled:opacity-50";

export function RahmenForm({ kapital, auslaender }: { kapital?: number; auslaender?: number }) {
  const [state, action, pending] = useActionState<MarktState, FormData>(rahmenSpeichern, {});
  return (
    <form action={action}>
      <div className="karte overflow-hidden rounded-[18px] bg-card">
        <label className="flex min-h-11 items-center gap-3 border-b border-separator px-4">
          <span className="w-40 shrink-0 text-[15px]">Kapital (EUR)</span>
          <input
            name="kapital"
            inputMode="numeric"
            required
            defaultValue={kapital ?? ""}
            placeholder="z. B. 5000000"
            className="min-w-0 flex-1 bg-transparent py-3 text-right text-[17px] tabular-nums outline-none placeholder:text-label-3"
          />
        </label>
        <label className="flex min-h-11 items-center gap-3 px-4">
          <span className="w-40 shrink-0 text-[15px]">Freie Ausländerplätze</span>
          <input
            name="auslaender"
            inputMode="numeric"
            required
            defaultValue={auslaender ?? ""}
            placeholder="z. B. 0"
            className="min-w-0 flex-1 bg-transparent py-3 text-right text-[17px] tabular-nums outline-none placeholder:text-label-3"
          />
        </label>
      </div>
      {state.meldung && <p role="status" className={`mt-2 px-4 text-[13px] ${state.ok ? "text-green" : "text-red"}`}>{state.meldung}</p>}
      <button type="submit" disabled={pending} className={`${KNOPF} mt-3`}>
        {pending ? "Speichern …" : "Rahmen speichern"}
      </button>
    </form>
  );
}

export function SuchKnopf() {
  const [state, action, pending] = useActionState<MarktState>(jetztSuchen, {});
  return (
    <form action={action} onSubmit={() => haptic()}>
      <button type="submit" disabled={pending} className={KNOPF}>
        {pending ? "Suche läuft (bis ca. 2 Minuten) …" : "Markt jetzt durchsuchen"}
      </button>
      {state.meldung && <p role="status" className={`mt-2 px-4 text-[13px] ${state.ok ? "text-green" : "text-red"}`}>{state.meldung}</p>}
    </form>
  );
}
