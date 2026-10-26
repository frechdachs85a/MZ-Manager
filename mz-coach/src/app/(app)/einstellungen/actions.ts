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
  return r;
}

export async function spieltagJetztAbrufen(): Promise<AbrufState> {
  const { spieltagAbrufen } = await import("@/lib/mz/abruf/spieltag");
  const r = await spieltagAbrufen(getDb(), { manuell: true });
  revalidatePath("/", "layout");
  return r;
}

export async function kaderHochladen(_prev: AbrufState, formData: FormData): Promise<AbrufState> {
  const dateien = formData.getAll("datei").filter((d): d is File => d instanceof File && d.size > 0);
  if (dateien.length === 0) return { meldung: "Keine Datei ausgewählt." };
  // Grenze in next.config.ts: 4 MB je Anfrage. Alle vier Seiten zusammen ca. 1,4 MB.
  const summe = dateien.reduce((n, d) => n + d.size, 0);
  if (summe > 3_800_000) return { meldung: "Zusammen zu groß (über 3,8 MB). Bitte weniger Dateien auf einmal hochladen." };
  const { dateienEinlesen } = await import("@/lib/mz/abruf/kader");
  const r = dateienEinlesen(getDb(), await Promise.all(dateien.map(async (d) => ({ name: d.name, html: await d.text() }))));
  revalidatePath("/", "layout");
  return r;
}

export type FreundState = { meldung?: string; ok?: boolean };

export async function freundTeamSpeichern(_prev: FreundState, formData: FormData): Promise<FreundState> {
  const { speichereFreundTeam } = await import("@/lib/db/freunde");
  const tid = String(formData.get("tid") ?? "").trim();
  const taktik = String(formData.get("taktik") ?? "").trim();
  if (!/^\d+$/.test(tid)) return { meldung: "Die tid ist eine Zahl (aus ?p=team&tid=…)." };
  if (!taktik) return { meldung: "Taktik-Reiter angeben, z. B. freund." };
  speichereFreundTeam(getDb(), { tid: Number(tid), taktik });
  revalidatePath("/", "layout");
  return { ok: true, meldung: "Gespeichert." };
}
