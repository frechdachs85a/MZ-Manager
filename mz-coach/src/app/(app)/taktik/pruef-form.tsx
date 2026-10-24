"use client";

import { useActionState } from "react";
import { Spielfeld } from "@/components/spielfeld";
import { taktikPruefen, type PruefState } from "./actions";

const TITEL = ["Startaufstellung", "Alternative 1", "Alternative 2"];

export function PruefForm() {
  const [state, action, pending] = useActionState<PruefState, FormData>(taktikPruefen, {});
  const e = state.ergebnis;
  return (
    <div>
      <form action={action}>
        <textarea
          name="xml"
          rows={6}
          spellCheck={false}
          placeholder="<SoccerTactics> … </SoccerTactics> aus dem Taktik-Editor einfügen"
          className="block w-full rounded-[14px] bg-card px-4 py-3 font-mono text-[13px] outline-none placeholder:text-label-3"
        />
        <button
          type="submit"
          disabled={pending}
          className="pressable mt-3 min-h-[50px] w-full rounded-[14px] bg-tint text-[17px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Prüfe …" : "Taktik prüfen"}
        </button>
      </form>
      {state.fehlerXml && <p role="alert" className="mt-2 px-4 text-[13px] text-red">{state.fehlerXml}</p>}
      {e && (
        <div className="mt-4 space-y-4">
          <div className={`rounded-[14px] p-4 ${e.ok ? "bg-green/15" : "bg-red/15"}`}>
            <div className={`text-[17px] font-semibold ${e.ok ? "text-green" : "text-red"}`}>
              {e.ok ? "Keine Fehler nach der Prüfliste" : `${e.fehler.length} Fehler, so nicht verwenden`}
            </div>
            <div className="mt-0.5 text-[13px] text-label-2">
              {e.team.tactics ?? "?"} / {e.team.playstyle ?? "?"} / {e.team.aggression ?? "?"}
            </div>
          </div>
          {e.fehler.length > 0 && (
            <ul className="space-y-1.5 rounded-[14px] bg-card p-4 text-[15px]">
              {e.fehler.map((f, i) => (
                <li key={i}>
                  <span className="mr-1.5 font-semibold text-red">Punkt {f.regel || "–"}:</span>
                  {f.text}
                </li>
              ))}
            </ul>
          )}
          {e.hinweise.length > 0 && (
            <ul className="space-y-1.5 rounded-[14px] bg-card p-4 text-[15px]">
              {e.hinweise.map((f, i) => (
                <li key={i}>
                  <span className="mr-1.5 font-semibold text-orange">Hinweis {f.regel}:</span>
                  {f.text}
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {e.aufstellungen.map((a, k) =>
              a ? <Spielfeld key={k} spieler={a} titel={TITEL[k]} /> : <p key={k} className="text-[13px] text-label-2">{TITEL[k]}: nicht gesetzt</p>,
            )}
          </div>
          <div className="rounded-[14px] bg-card p-4 text-[15px]">
            <div className="mb-1 text-[13px] uppercase tracking-wide text-label-2">Bank</div>
            {e.bank.map((b) => (
              <div key={b.y} className="flex justify-between">
                <span>{b.name}{b.torwart && " (subgoalie)"}</span>
                <span className="tabular-nums text-label-2">y {b.y}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
