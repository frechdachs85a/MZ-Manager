"use server";

// Push-Anmeldung der Geräte und Nachrichten als gelesen markieren (nur angemeldet erreichbar, proxy.ts)
import { getDb } from "@/lib/db";
import { alsGelesen, benachrichtige, pushAbmelden, pushAnmelden, vapid } from "@/lib/nachricht";

export async function pushSchluessel(): Promise<string> {
  return vapid(getDb()).publicKey;
}

export async function pushAbonnieren(abo: { endpoint: string; keys?: Record<string, string> }): Promise<{ ok: boolean; meldung: string }> {
  if (!abo?.endpoint || !abo.keys?.p256dh || !abo.keys?.auth) return { ok: false, meldung: "Ungültige Anmeldung des Geräts." };
  const db = getDb();
  pushAnmelden(db, abo);
  return { ok: true, meldung: "Dieses Gerät bekommt jetzt Push-Nachrichten." };
}

export async function pushBeenden(endpoint: string) {
  pushAbmelden(getDb(), endpoint);
}

export async function pushTest(): Promise<{ ok: boolean; meldung: string }> {
  const n = await benachrichtige(getDb(), { titel: "MZ Coach: Test", text: "Push-Nachrichten funktionieren auf diesem Gerät.", link: "/einstellungen" });
  return n ? { ok: true, meldung: `An ${n} Gerät(e) gesendet.` } : { ok: false, meldung: "Kein Gerät angemeldet." };
}

export async function nachrichtenGelesen(ids: number[]) {
  alsGelesen(getDb(), ids.filter((i) => Number.isInteger(i)));
}
