"use client";

// Formulare des Transfermarkts: Rahmen (Saldo, Ausländer, Arbeitsbewilligungen) und Knopf „Markt jetzt durchsuchen“.

import { useActionState } from "react";
import { haptic } from "@/lib/haptics";
import { jetztSuchen, rahmenSpeichern, type MarktState } from "./actions";

const KNOPF =
  "pressable min-h-[50px] w-full knopf text-[17px] font-bold disabled:opacity-50";

function Meldung({ s }: { s: MarktState }) {
  return s.meldung ? <p role="status" className={`mt-2 px-4 text-[13px] ${s.ok ? "text-green" : "text-red"}`}>{s.meldung}</p> : null;
}

function Feld({ name, label, wert, platzhalter }: { name: string; label: string; wert?: number; platzhalter: string }) {
  return (
    <label className="flex min-h-11 items-center gap-3 border-b border-separator px-4 last:border-b-0">
      <span className="w-40 shrink-0 text-[15px]">{label}</span>
      <input
        name={name}
        inputMode="numeric"
        required
        defaultValue={wert ?? ""}
        placeholder={platzhalter}
        className="min-w-0 flex-1 bg-transparent py-3 text-right text-[17px] tabular-nums outline-none placeholder:text-label-3"
      />
    </label>
  );
}

// Formular: Rahmen des Transfermarkts
export function RahmenForm({ werte }: { werte?: Record<string, number> }) {
  const [state, action, pending] = useActionState<MarktState, FormData>(rahmenSpeichern, {});
  return (
    <form action={action}>
      <div className="karte overflow-hidden rounded-[18px] bg-card">
        <Feld name="kapital" label="Verfügbarer Saldo (EUR)" wert={werte?.kapital} platzhalter="z. B. 3329364" />
        <Feld name="auslaender" label="Ausländische Spieler" wert={werte?.auslaender} platzhalter="z. B. 5" />
        <Feld name="auslaenderMax" label="… maximum" wert={werte?.auslaenderMax} platzhalter="z. B. 5" />
        <Feld name="bewilligungen" label="Arbeitsbewilligungen" wert={werte?.bewilligungen} platzhalter="z. B. 2" />
        <Feld name="bewilligungenMax" label="… maximum" wert={werte?.bewilligungenMax} platzhalter="z. B. 5" />
      </div>
      <Meldung s={state} />
      <button type="submit" disabled={pending} className={`${KNOPF} mt-3`}>
        {pending ? "Speichern …" : "Rahmen speichern"}
      </button>
    </form>
  );
}

// Knopf: Markt jetzt durchsuchen
export function SuchKnopf() {
  const [state, action, pending] = useActionState<MarktState>(jetztSuchen, {});
  return (
    <form action={action} onSubmit={() => haptic()}>
      <button type="submit" disabled={pending} className={KNOPF}>
        {pending ? "Suche läuft (bis ca. 2 Minuten) …" : "Markt jetzt durchsuchen"}
      </button>
      <Meldung s={state} />
    </form>
  );
}
