"use server";

// Server-Aktion der Spieleseite: Stats-XML eines Spiels von Hand einfügen.

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";

export type EinfuegenState = { ok?: boolean; meldung?: string };

// Eingefügte Stats-XML prüfen und speichern
export async function spielEinfuegen(_prev: EinfuegenState, formData: FormData): Promise<EinfuegenState> {
  const text = String(formData.get("xml") ?? "");
  if (!text.trim()) return { meldung: "Bitte die Stats-XML einfügen." };
  const { meldungAus, spielXmlEinlesen } = await import("@/lib/mz/abruf/kader");
  try {
    const meldung = spielXmlEinlesen(getDb(), text);
    revalidatePath("/spiele");
    return { ok: true, meldung };
  } catch (e) {
    return { meldung: meldungAus(e) };
  }
}
