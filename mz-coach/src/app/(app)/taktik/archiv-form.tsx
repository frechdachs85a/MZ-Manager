"use client";

// Formular zum Speichern einer geprüften Taktik im Archiv.

import { useActionState } from "react";
import { taktikArchivieren, type ArchivState } from "./actions";

// Formular: Taktik im Archiv speichern
export function ArchivForm({ reiter }: { reiter: string[] }) {
  const [state, action, pending] = useActionState<ArchivState, FormData>(taktikArchivieren, {});
  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-3">
        <input
          name="reiter"
          list="reiter-liste"
          required
          placeholder="Reiter, z. B. kupass"
          className="karte min-h-11 w-48 rounded-[10px] bg-card px-3 text-[15px] outline-none"
        />
        <datalist id="reiter-liste">
          {reiter.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <button disabled={pending} className="pressable knopf min-h-11 px-5 text-[15px] font-medium disabled:opacity-50">
          {pending ? "Speichern …" : "Im Archiv speichern"}
        </button>
      </div>
      <textarea
        name="xml"
        required
        rows={5}
        placeholder="XML aus dem Taktik-Editor (Export) einfügen"
        className="karte block w-full rounded-[10px] bg-card px-4 py-3 font-mono text-[12px] outline-none placeholder:text-label-3"
      />
      {state.meldung && <p role="status" className={`text-[13px] ${state.ok ? "text-green" : "text-red"}`}>{state.meldung}</p>}
    </form>
  );
}
