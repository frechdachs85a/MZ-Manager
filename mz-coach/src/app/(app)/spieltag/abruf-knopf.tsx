"use client";

import { useActionState } from "react";
import { haptic } from "@/lib/haptics";
import { spieltagJetztAbrufen, type AbrufState } from "../einstellungen/actions";

export function SpieltagKnopf() {
  const [state, action, pending] = useActionState<AbrufState>(spieltagJetztAbrufen, {});
  return (
    <form action={action} onSubmit={() => haptic()}>
      <button type="submit" disabled={pending} className="pressable min-h-[44px] knopf px-5 text-[15px] font-bold disabled:opacity-50">
        {pending ? "Abruf läuft …" : "Jetzt abrufen"}
      </button>
      {state.meldung && (
        <p role="status" className={`mt-2 max-w-[80ch] text-[13px] ${state.ok ? "text-green" : "text-red"}`}>
          {state.meldung}
        </p>
      )}
    </form>
  );
}
