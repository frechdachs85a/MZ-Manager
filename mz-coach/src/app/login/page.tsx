"use client";

import Image from "next/image";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <main className="pt-safe px-safe flex min-h-dvh flex-col items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center">
          <Image src="/icons/icon-192.png" alt="" width={84} height={84} className="rounded-[20px] shadow-sm" priority />
          <h1 className="mt-4 text-[28px] font-bold tracking-tight">MZ Coach</h1>
          <p className="mt-1 text-[15px] text-label-2">FC Toho</p>
        </div>

        <form action={action} className="mt-8">
          {/* verstecktes Benutzerfeld, damit der iCloud-Schlüsselbund das Passwort zuordnen kann */}
          <input type="text" name="username" autoComplete="username" defaultValue="marcus" hidden readOnly />
          <div className="overflow-hidden karte rounded-[18px] bg-card">
            <label className="sr-only" htmlFor="password">Passwort</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              placeholder="Passwort"
              className="min-h-11 w-full bg-transparent px-4 py-3 text-[17px] outline-none placeholder:text-label-3"
            />
          </div>
          {state.error && (
            <p role="alert" className="mt-2 px-4 text-[13px] text-red">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="pressable mt-5 min-h-[50px] w-full knopf text-[17px] font-bold disabled:opacity-50"
          >
            {pending ? "Anmelden …" : "Anmelden"}
          </button>
        </form>
      </div>
    </main>
  );
}
