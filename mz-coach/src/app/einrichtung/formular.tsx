"use client";

import { useActionState } from "react";
import { einrichten, type EinrichtungState } from "./actions";

const feld = "min-h-11 w-full bg-transparent px-4 py-3 text-[17px] outline-none placeholder:text-label-3";

export function EinrichtungFormular() {
  const [state, action, pending] = useActionState<EinrichtungState, FormData>(einrichten, {});
  return (
    <form action={action} className="mt-8">
      <input type="text" name="username" autoComplete="username" defaultValue="marcus" hidden readOnly />
      <div className="karte divide-y divide-separator overflow-hidden rounded-[18px] bg-card">
        <label className="sr-only" htmlFor="code">Einrichtungscode</label>
        <input id="code" name="code" required autoFocus autoComplete="off" placeholder="Einrichtungscode (z. B. 1A2B-3C4D-5E6F)" className={feld} />
        <label className="sr-only" htmlFor="passwort">Neues Passwort</label>
        <input id="passwort" name="passwort" type="password" required minLength={10} autoComplete="new-password" placeholder="Neues App-Passwort (mind. 10 Zeichen)" className={feld} />
        <label className="sr-only" htmlFor="passwort2">Passwort wiederholen</label>
        <input id="passwort2" name="passwort2" type="password" required minLength={10} autoComplete="new-password" placeholder="Passwort wiederholen" className={feld} />
      </div>
      {state.error && (
        <p role="alert" className="mt-2 px-4 text-[13px] text-red">{state.error}</p>
      )}
      <button type="submit" disabled={pending} className="pressable mt-5 min-h-[50px] w-full knopf text-[17px] font-bold disabled:opacity-50">
        {pending ? "Speichern …" : "Passwort festlegen"}
      </button>
    </form>
  );
}
