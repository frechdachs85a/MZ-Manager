"use server";

// Server-Aktion der Zentrale: Vorschlag des Taktik-Checks für einen Reiter in ManagerZone übernehmen (nur auf Klick).

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";

export type UebernahmeState = { ok?: boolean; meldung?: string };

// Vorschlag für den Reiter aus dem Formular in den gleichnamigen Editor-Reiter schreiben
export async function vorschlagUebernehmen(_prev: UebernahmeState, formData: FormData): Promise<UebernahmeState> {
  const reiter = String(formData.get("reiter") ?? "");
  if (!reiter) return { meldung: "Reiter fehlt." };
  const { taktikUebernehmen } = await import("@/lib/mz/abruf/liga");
  const r = await taktikUebernehmen(getDb(), reiter);
  revalidatePath("/");
  revalidatePath("/taktik");
  return r;
}
