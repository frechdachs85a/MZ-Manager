"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { loescheZugang, speichereZugang } from "@/lib/mz/zugang";

export type ZugangState = { fehler?: string; ok?: boolean };

export async function zugangSpeichern(_prev: ZugangState, formData: FormData): Promise<ZugangState> {
  const benutzer = String(formData.get("benutzer") ?? "").trim();
  const passwort = String(formData.get("passwort") ?? "");
  if (!benutzer || !passwort) return { fehler: "Benutzername und Passwort angeben." };
  try {
    speichereZugang(getDb(), { benutzer, passwort });
  } catch (e) {
    // Nur die Meldung, nie die Eingaben
    return { fehler: e instanceof Error ? e.message : "Speichern fehlgeschlagen." };
  }
  revalidatePath("/einstellungen");
  return { ok: true };
}

export async function zugangLoeschen() {
  loescheZugang(getDb());
  revalidatePath("/einstellungen");
}
