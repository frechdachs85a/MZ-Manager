"use client";

import { useActionState } from "react";
import { kaderHochladen, type AbrufState } from "./actions";

export function HochladenForm() {
  const [state, action, pending] = useActionState<AbrufState, FormData>(kaderHochladen, {});
  return (
    <form action={action}>
      <div className="rounded-[14px] bg-card px-4 py-3">
        <label htmlFor="datei" className="block text-[15px] font-medium">
          Gespeicherte Seiten (.html), mehrere auf einmal möglich
        </label>
        <input
          id="datei"
          name="datei"
          type="file"
          accept=".html,.htm,.xml,.txt,text/html,text/xml,text/plain"
          multiple
          required
          className="mt-2 block w-full text-[15px] text-label-2 file:mr-3 file:min-h-11 file:rounded-[10px] file:border-0 file:bg-fill file:px-4 file:text-[15px] file:font-medium file:text-tint"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="pressable mt-3 min-h-[50px] w-full rounded-[14px] bg-tint text-[17px] font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Wird gelesen …" : "Seiten übernehmen"}
      </button>
      {state.meldung && (
        <p role="status" className={`mt-2 px-4 text-[13px] ${state.ok ? "text-green" : "text-red"}`}>
          {state.meldung}
        </p>
      )}
    </form>
  );
}
