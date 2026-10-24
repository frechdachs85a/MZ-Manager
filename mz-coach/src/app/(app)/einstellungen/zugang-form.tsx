"use client";

import { useActionState } from "react";
import { zugangSpeichern, type ZugangState } from "./actions";

export function ZugangForm() {
  const [state, action, pending] = useActionState<ZugangState, FormData>(zugangSpeichern, {});
  return (
    <form action={action}>
      <div className="overflow-hidden rounded-[14px] bg-card">
        <input
          name="benutzer"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="ManagerZone-Benutzername"
          className="min-h-11 w-full border-b border-separator bg-transparent px-4 py-3 text-[17px] outline-none placeholder:text-label-3"
        />
        <input
          name="passwort"
          type="password"
          autoComplete="off"
          required
          placeholder="ManagerZone-Passwort"
          className="min-h-11 w-full bg-transparent px-4 py-3 text-[17px] outline-none placeholder:text-label-3"
        />
      </div>
      {state.fehler && <p role="alert" className="mt-2 px-4 text-[13px] text-red">{state.fehler}</p>}
      {state.ok && <p className="mt-2 px-4 text-[13px] text-green">Gespeichert, verschlüsselt.</p>}
      <button
        type="submit"
        disabled={pending}
        className="pressable mt-3 min-h-[50px] w-full rounded-[14px] bg-tint text-[17px] font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Speichern …" : "Zugang speichern"}
      </button>
    </form>
  );
}
