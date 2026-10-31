"use server";

// Jugend: eigene Entscheidung behalten/abgeben je Spieler (Marcus, 31.10.2026)

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { setzeJugendEntscheidung } from "@/lib/db/watch";

export async function jugendEntscheiden(formData: FormData) {
  const pid = Number(formData.get("pid"));
  const e = formData.get("entscheidung") === "abgeben" ? "abgeben" : "behalten";
  if (pid > 0) setzeJugendEntscheidung(getDb(), pid, e);
  revalidatePath("/jugend");
  revalidatePath(`/kader/${pid}`);
}
