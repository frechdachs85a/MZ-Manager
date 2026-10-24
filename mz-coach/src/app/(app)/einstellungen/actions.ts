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

export type AbrufState = { meldung?: string; ok?: boolean };

export async function kaderJetztAbrufen(): Promise<AbrufState> {
  const { kaderAbrufen } = await import("@/lib/mz/abruf/kader");
  const r = await kaderAbrufen(getDb(), { manuell: true });
  revalidatePath("/", "layout");
  return r.ok ? { ok: true, meldung: ergebnisText(r) } : { meldung: r.meldung };
}

export async function kaderHochladen(_prev: AbrufState, formData: FormData): Promise<AbrufState> {
  const datei = formData.get("datei");
  if (!(datei instanceof File) || datei.size === 0) return { meldung: "Keine Datei ausgewählt." };
  // Server Actions nehmen standardmäßig höchstens 1 MB an, die Kaderseite hat ca. 180 KB.
  if (datei.size > 950_000) return { meldung: "Datei zu groß (über 950 KB). Bitte als \"Webseite, nur HTML\" speichern." };
  const { kaderAusDatei } = await import("@/lib/mz/abruf/kader");
  const r = kaderAusDatei(getDb(), await datei.text(), datei.name);
  revalidatePath("/", "layout");
  return r.ok ? { ok: true, meldung: ergebnisText(r) } : { meldung: r.meldung };
}

function ergebnisText(r: { spieler: number; neu: number; aenderungen: number }) {
  return `${r.spieler} Spieler gelesen, ${r.neu} neu, ${r.aenderungen} Änderungen gespeichert.`;
}
