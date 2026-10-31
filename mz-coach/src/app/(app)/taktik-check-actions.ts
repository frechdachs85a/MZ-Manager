"use server";

// Server-Aktionen der Zentrale: Vorschläge des Taktik-Checks und des Portfolio-Plans in ManagerZone übernehmen (nur auf Klick).

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

// Portfolio-Vorschlag für den Reiter aus dem Formular übernehmen (Reiter wird mit dem neuen Stil überschrieben)
export async function portfolioVorschlagUebernehmen(_prev: UebernahmeState, formData: FormData): Promise<UebernahmeState> {
  const reiter = String(formData.get("reiter") ?? "");
  if (!reiter) return { meldung: "Reiter fehlt." };
  const { portfolioUebernehmen } = await import("@/lib/mz/abruf/liga");
  const r = await portfolioUebernehmen(getDb(), reiter);
  revalidatePath("/");
  revalidatePath("/taktik");
  revalidatePath("/portfolio");
  return r;
}
