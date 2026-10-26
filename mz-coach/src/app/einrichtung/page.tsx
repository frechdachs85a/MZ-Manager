// Ersteinrichtung: App-Passwort festlegen, solange noch keins gesetzt ist.

import Image from "next/image";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { istEingerichtet } from "@/lib/auth/geheimnisse";
import { EinrichtungFormular } from "./formular";

// Seite Ersteinrichtung
export default async function Einrichtung() {
  await connection();
  if (istEingerichtet()) redirect("/login");
  return (
    <main className="pt-safe px-safe flex min-h-dvh flex-col items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Image src="/icons/icon-192.png" alt="" width={84} height={84} className="rounded-[20px] shadow-sm" priority />
          <h1 className="mt-4 text-[28px] font-bold tracking-tight">Ersteinrichtung</h1>
          <p className="mt-2 text-[15px] text-label-2">
            Leg dein App-Passwort fest. Den Einrichtungscode findest du im Serverprotokoll beim Hoster (Zeile „Einrichtungscode“).
          </p>
        </div>
        <EinrichtungFormular />
      </div>
    </main>
  );
}
