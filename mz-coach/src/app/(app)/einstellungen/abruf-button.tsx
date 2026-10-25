"use client";

import { useActionState } from "react";
import { haptic } from "@/lib/haptics";
import { kaderJetztAbrufen, type AbrufState } from "./actions";

export function AbrufButton() {
  const [state, action, pending] = useActionState<AbrufState>(kaderJetztAbrufen, {});
  return (
    <form action={action} onSubmit={() => haptic()}>
      <button
        type="submit"
        disabled={pending}
        className="pressable min-h-[50px] w-full rounded-[14px] bg-tint shadow-[0_6px_16px_-6px_var(--tint)] text-[17px] font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Abruf läuft …" : "Kader jetzt abrufen"}
      </button>
      {state.meldung && (
        <p role="status" className={`mt-2 px-4 text-[13px] ${state.ok ? "text-green" : "text-red"}`}>
          {state.meldung}
        </p>
      )}
    </form>
  );
}
