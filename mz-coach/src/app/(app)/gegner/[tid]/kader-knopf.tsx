"use client";

import { useActionState } from "react";
import { gegnerKaderHolen, type HolState } from "./actions";

export function KaderKnopf({ tid }: { tid: number }) {
  const [state, action, pending] = useActionState<HolState>(() => gegnerKaderHolen(tid), {});
  return (
    <form action={action}>
      <button disabled={pending} className="pressable text-[14px] font-medium text-tint disabled:opacity-50">
        {pending ? "Lese Kaderseite …" : "Kaderseite des Gegners holen (Login)"}
      </button>
      {state.meldung && <p role="status" className={`mt-2 text-[13px] ${state.ok ? "text-green" : "text-red"}`}>{state.meldung}</p>}
    </form>
  );
}
