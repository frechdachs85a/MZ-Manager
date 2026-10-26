"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { passwortHash } from "@/lib/auth/geheimnisse";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  getSessionSecret,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth/session";

// Einfache Bremse gegen Durchprobieren: nach 5 Fehlversuchen 15 Minuten Sperre je IP.
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

export type LoginState = { error?: string };

// Anmelden: Passwort prüfen, Sitzungs-Cookie setzen
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "lokal";
  const entry = attempts.get(ip);
  if (entry && entry.until > Date.now()) {
    return { error: "Zu viele Fehlversuche. Probier es in 15 Minuten nochmal." };
  }

  const stored = passwortHash();
  if (!stored) redirect("/einrichtung");

  const password = String(formData.get("password") ?? "");
  if (!(await verifyPassword(password, stored))) {
    const count = (entry?.count ?? 0) + 1;
    attempts.set(ip, { count, until: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0 });
    return { error: "Passwort falsch." };
  }

  attempts.delete(ip);
  (await cookies()).set(SESSION_COOKIE, createSessionToken(getSessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/");
}

// Abmelden: Sitzungs-Cookie löschen
export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
