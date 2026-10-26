"use client";

// Knopf „Kader jetzt abrufen“ auf der Einstellungsseite (startet den Kaderabruf von Hand und zeigt die Meldung).

import { useActionState } from "react";
import { haptic } from "@/lib/haptics";
import { kaderJetztAbrufen, type AbrufState } from "./actions";

// Knopf: Kaderabruf von Hand starten, Meldung darunter
export function AbrufButton() {
  const [state, action, pending] = useActionState<AbrufState>(kaderJetztAbrufen, {});
  return (
    <form action={action} onSubmit={() => haptic()}>
      <button
        type="submit"
        disabled={pending}
        className="pressable min-h-[50px] w-full knopf text-[17px] font-bold disabled:opacity-50"
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
