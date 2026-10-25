"use client";

import { useActionState } from "react";
import { fehlendeSpieleHolen, type HolState } from "./actions";

export function HolKnopf({ tid, anzahl }: { tid: number; anzahl: number }) {
  const [state, action, pending] = useActionState<HolState>(() => fehlendeSpieleHolen(tid), {});
  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className="pressable min-h-[50px] w-full rounded-[14px] bg-tint shadow-[0_6px_16px_-6px_var(--tint)] text-[17px] font-semibold text-white disabled:opacity-50"
      >
        {pending ? `Hole ${anzahl} Spiele … (ca. ${Math.ceil(anzahl * 0.3)} Min.)` : `${anzahl} fehlende Spiele von ManagerZone holen`}
      </button>
      {state.meldung && (
        <p role="status" className={`mt-2 px-4 text-[13px] ${state.ok ? "text-green" : "text-red"}`}>
          {state.meldung}
        </p>
      )}
    </form>
  );
}
