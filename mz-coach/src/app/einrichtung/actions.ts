"use server";

import { timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { einrichtungscode, istEingerichtet, speicherePasswortHash } from "@/lib/auth/geheimnisse";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, getSessionSecret, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/session";

// Ersteinrichtung: App-Passwort festlegen. Nur solange noch keins gesetzt ist und nur mit dem Einrichtungscode
// aus dem Serverprotokoll (sieht nur, wer beim Hoster angemeldet ist). Bremse wie beim Login.
const versuche = new Map<string, { count: number; until: number }>();
const MAX = 5;
const SPERRE_MS = 15 * 60 * 1000;

export type EinrichtungState = { error?: string };

const gleich = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// Ersteinrichtung: Code prüfen, App-Passwort setzen
export async function einrichten(_prev: EinrichtungState, formData: FormData): Promise<EinrichtungState> {
  if (istEingerichtet()) redirect("/login");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "lokal";
  const v = versuche.get(ip);
  if (v && v.until > Date.now()) return { error: "Zu viele Fehlversuche. Probier es in 15 Minuten nochmal." };

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const pw = String(formData.get("passwort") ?? "");
  const pw2 = String(formData.get("passwort2") ?? "");
  const soll = einrichtungscode();
  if (!soll || !gleich(code, soll)) {
    const count = (v?.count ?? 0) + 1;
    versuche.set(ip, { count, until: count >= MAX ? Date.now() + SPERRE_MS : 0 });
    return { error: "Einrichtungscode falsch. Er steht im Serverprotokoll beim Hoster (Zeile „Einrichtungscode“)." };
  }
  if (pw.length < 10) return { error: "Bitte mindestens 10 Zeichen." };
  if (pw !== pw2) return { error: "Die beiden Passwörter sind nicht gleich." };

  speicherePasswortHash(await hashPassword(pw));
  versuche.delete(ip);
  (await cookies()).set(SESSION_COOKIE, createSessionToken(getSessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/einstellungen");
}
