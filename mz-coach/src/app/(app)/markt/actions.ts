"use server";

// Server-Aktionen des Transfermarkts: Rahmen speichern, Empfehlung ablehnen/zurücknehmen, Suche starten.

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { lehneAb, nimmAblehnungZurueck, RAHMEN_FELDER, speichereMarktRahmen, type MarktRahmenDaten } from "@/lib/db/markt";
import { entferneVonWatchlist, nimmAufWatchlist } from "@/lib/db/watch";
import { marktErgebnis } from "@/lib/markt-ergebnis";

export type MarktState = { meldung?: string; ok?: boolean };

// Ganze Zahl ≥ 0 aus dem Formular (Leerzeichen und Punkte als Tausendertrenner erlaubt)
function ganzzahl(v: FormDataEntryValue | null): number | undefined {
  const t = String(v ?? "").replace(/[\s.]/g, "");
  return /^\d+$/.test(t) ? Number(t) : undefined;
}

// Rahmen des Transfermarkts speichern (alle Felder ganze Zahlen, belegt ≤ maximum)
export async function rahmenSpeichern(_prev: MarktState, formData: FormData): Promise<MarktState> {
  const werte = Object.fromEntries(RAHMEN_FELDER.map((f) => [f, ganzzahl(formData.get(f))]));
  if (Object.values(werte).some((v) => v === undefined)) return { meldung: "Bitte alle Felder als ganze Zahl eintragen." };
  const r = werte as MarktRahmenDaten;
  if (r.auslaender > r.auslaenderMax || r.bewilligungen > r.bewilligungenMax) {
    return { meldung: "Belegt kann nicht größer als das Maximum sein." };
  }
  speichereMarktRahmen(getDb(), r);
  revalidatePath("/markt");
  return { ok: true, meldung: "Gespeichert." };
}

// Empfehlung ablehnen: kommt nicht wieder
export async function ablehnen(formData: FormData) {
  const pid = Number(formData.get("pid"));
  const name = String(formData.get("name") ?? "");
  if (pid > 0) lehneAb(getDb(), pid, name);
  revalidatePath("/markt");
}

// Ablehnung zurücknehmen
export async function zuruecknehmen(formData: FormData) {
  const pid = Number(formData.get("pid"));
  if (pid > 0) nimmAblehnungZurueck(getDb(), pid);
  revalidatePath("/markt");
}

// Marktsuche von Hand
export async function jetztSuchen(): Promise<MarktState> {
  const { marktAbrufen } = await import("@/lib/mz/abruf/markt");
  const r = await marktAbrufen(getDb(), { manuell: true });
  revalidatePath("/markt");
  return r;
}

// Vorschlag annehmen: kommt mit Momentaufnahme auf die Watchlist (Marcus, 31.10.2026)
export async function annehmen(formData: FormData) {
  const pid = Number(formData.get("pid"));
  const db = getDb();
  const b = marktErgebnis(db).ergebnis?.alle.find((x) => x.kandidat.pid === pid);
  if (b)
    nimmAufWatchlist(db, b.kandidat, { rolle: b.ziel.rolle, statt: b.ziel.spieler.name, gewinn: b.gewinn, neu: b.neu, preis: b.preis });
  revalidatePath("/markt");
  revalidatePath("/markt/watchlist");
}

// Von der Watchlist entfernen (jederzeit)
export async function vonWatchlist(formData: FormData) {
  const pid = Number(formData.get("pid"));
  if (pid > 0) entferneVonWatchlist(getDb(), pid);
  revalidatePath("/markt");
  revalidatePath("/markt/watchlist");
}
