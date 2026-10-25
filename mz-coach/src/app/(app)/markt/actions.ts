"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { lehneAb, nimmAblehnungZurueck, speichereMarktRahmen } from "@/lib/db/markt";

export type MarktState = { meldung?: string; ok?: boolean };

// Ganze Zahl ≥ 0 aus dem Formular (Leerzeichen und Punkte als Tausendertrenner erlaubt)
function ganzzahl(v: FormDataEntryValue | null): number | undefined {
  const t = String(v ?? "").replace(/[\s.]/g, "");
  return /^\d+$/.test(t) ? Number(t) : undefined;
}

export async function rahmenSpeichern(_prev: MarktState, formData: FormData): Promise<MarktState> {
  const kapital = ganzzahl(formData.get("kapital"));
  const auslaenderFrei = ganzzahl(formData.get("auslaender"));
  if (kapital === undefined || auslaenderFrei === undefined) {
    return { meldung: "Bitte beide Felder als ganze Zahl eintragen." };
  }
  speichereMarktRahmen(getDb(), { kapital, auslaenderFrei });
  revalidatePath("/markt");
  return { ok: true, meldung: "Gespeichert." };
}

export async function ablehnen(formData: FormData) {
  const pid = Number(formData.get("pid"));
  const name = String(formData.get("name") ?? "");
  if (pid > 0) lehneAb(getDb(), pid, name);
  revalidatePath("/markt");
}

export async function zuruecknehmen(formData: FormData) {
  const pid = Number(formData.get("pid"));
  if (pid > 0) nimmAblehnungZurueck(getDb(), pid);
  revalidatePath("/markt");
}

export async function jetztSuchen(): Promise<MarktState> {
  const { marktAbrufen } = await import("@/lib/mz/abruf/markt");
  const r = await marktAbrufen(getDb(), { manuell: true });
  revalidatePath("/markt");
  return r;
}
