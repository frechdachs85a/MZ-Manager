"use client";

import { useActionState } from "react";
import { kombiBestaetigen, type ScoutState } from "./actions";

type Fall = { pid: number; name: string; sterne?: string; grund: string; text?: string; hoch?: number; niedrig?: number };

function Formular({ f }: { f: Fall }) {
  const [state, action, laeuft] = useActionState<ScoutState, FormData>(kombiBestaetigen, {});
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2 text-[13px]">
      <input type="hidden" name="pid" value={f.pid} />
      <label className="flex flex-col">
        <span className="text-label-2">Rang</span>
        <input name="rang" type="number" min={1} max={20} required className="w-16 rounded-[8px] border border-separator bg-card px-2 py-1" />
      </label>
      <label className="flex flex-1 flex-col">
        <span className="text-label-2">Schlüsselwort (wörtlich aus dem Text)</span>
        <input name="schluessel" required className="rounded-[8px] border border-separator bg-card px-2 py-1" />
      </label>
      <label className="flex flex-col">
        <span className="text-label-2">Abzeichen</span>
        <input name="abzeichen" required className="w-36 rounded-[8px] border border-separator bg-card px-2 py-1" />
      </label>
      <button className="pressable knopf min-h-[34px] px-4 text-[13px] font-semibold disabled:opacity-50" disabled={laeuft}>
        Bestätigen
      </button>
      {state.meldung && <span className={state.ok ? "text-green" : "text-red"}>{state.meldung}</span>}
    </form>
  );
}

export function ScoutBestaetigen({ faelle }: { faelle: Fall[] }) {
  return (
    <ul className="karte divide-y divide-separator">
      {faelle.map((f) => (
        <li key={f.pid} className="p-4 text-[14px]">
          <div className="font-medium">
            {f.name} <span className="font-normal text-label-2">· Sterne {f.sterne ?? "?"}</span>
          </div>
          <div className="text-red">{f.grund}</div>
          {f.text ? (
            <blockquote className="mt-2 whitespace-pre-line border-l-2 border-gold-hell pl-3 text-label-2">{f.text}</blockquote>
          ) : (
            <div className="mt-2 text-label-3">Kein Text gespeichert.</div>
          )}
          {f.text && <Formular f={f} />}
        </li>
      ))}
    </ul>
  );
}
