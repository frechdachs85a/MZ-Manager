"use client";

import { useActionState } from "react";
import { spielEinfuegen, type EinfuegenState } from "./actions";

export function EinfuegenForm() {
  const [state, action, pending] = useActionState<EinfuegenState, FormData>(spielEinfuegen, {});
  return (
    <form action={action}>
      <textarea
        name="xml"
        rows={5}
        spellCheck={false}
        placeholder="<?xml …?><SoccerStatistics …> … </SoccerStatistics> einfügen"
        className="block w-full karte rounded-[18px] bg-card px-4 py-3 font-mono text-[13px] outline-none placeholder:text-label-3"
      />
      <button
        type="submit"
        disabled={pending}
        className="pressable mt-3 min-h-[50px] w-full rounded-[14px] bg-tint shadow-[0_6px_16px_-6px_var(--tint)] text-[17px] font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Wird gelesen …" : "Spiel speichern"}
      </button>
      {state.meldung && (
        <p role="status" className={`mt-2 px-4 text-[13px] ${state.ok ? "text-green" : "text-red"}`}>
          {state.meldung}
        </p>
      )}
    </form>
  );
}
