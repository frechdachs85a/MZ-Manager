"use server";

// Server-Aktionen der Zentrale: Vorschläge des Taktik-Checks und des Portfolio-Plans in ManagerZone übernehmen (nur auf Klick).

import { refresh, revalidatePath } from "next/cache";
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
  refresh();
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
  refresh();
  revalidatePath("/portfolio");
  return r;
}

// Reiter nur umbenennen (Name passt nicht zum Inhalt)
export async function reiterUmbenennenAktion(_prev: UebernahmeState, formData: FormData): Promise<UebernahmeState> {
  const reiter = String(formData.get("reiter") ?? "");
  if (!reiter) return { meldung: "Reiter fehlt." };
  const { reiterNameUebernehmen } = await import("@/lib/mz/abruf/liga");
  const r = await reiterNameUebernehmen(getDb(), reiter);
  revalidatePath("/");
  revalidatePath("/taktik");
  refresh();
  revalidatePath("/portfolio");
  return r;
}

// Reiter frei umbenennen (Taktikseite)
export async function reiterFreiUmbenennen(_prev: UebernahmeState, formData: FormData): Promise<UebernahmeState> {
  const alt = String(formData.get("reiter") ?? "");
  const neu = String(formData.get("name") ?? "");
  if (!alt) return { meldung: "Reiter fehlt." };
  const { reiterUmbenennenFrei } = await import("@/lib/mz/abruf/liga");
  const r = await reiterUmbenennenFrei(getDb(), alt, neu);
  revalidatePath("/");
  revalidatePath("/taktik");
  refresh();
  return r;
}

// Vorschlag für freund übernehmen (Bank oder anderer Stil)
export async function freundVorschlagUebernehmen(_prev: UebernahmeState, formData: FormData): Promise<UebernahmeState> {
  const reiter = String(formData.get("reiter") ?? "");
  const was = formData.get("was") === "stil" ? "stil" : "bank";
  if (!reiter) return { meldung: "Reiter fehlt." };
  const { freundUebernehmen } = await import("@/lib/mz/abruf/liga");
  const r = await freundUebernehmen(getDb(), reiter, was);
  revalidatePath("/");
  revalidatePath("/taktik");
  refresh();
  return r;
}

// Reiter löschen (leeren und Namen entfernen), nur auf Klick
export async function reiterLoeschenAktion(_prev: UebernahmeState, formData: FormData): Promise<UebernahmeState> {
  const reiter = String(formData.get("reiter") ?? "");
  if (!reiter) return { meldung: "Reiter fehlt." };
  const { reiterLoeschen } = await import("@/lib/mz/abruf/liga");
  const r = await reiterLoeschen(getDb(), reiter);
  revalidatePath("/");
  revalidatePath("/taktik");
  refresh();
  return r;
}

// Fehlenden bewährten Stil gegen den nächsten Gegner in den gewählten Reiter übernehmen (Spieltag-Seite)
export async function lueckeUebernehmenAktion(_prev: UebernahmeState, formData: FormData): Promise<UebernahmeState> {
  const reiter = String(formData.get("reiter") ?? "");
  if (!reiter) return { meldung: "Reiter fehlt." };
  const { lueckeUebernehmen } = await import("@/lib/mz/abruf/liga");
  const r = await lueckeUebernehmen(getDb(), reiter);
  revalidatePath("/");
  revalidatePath("/taktik");
  revalidatePath("/spieltag");
  refresh();
  return r;
}
