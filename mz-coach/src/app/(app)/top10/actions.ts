"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";

export type TopState = { ok?: boolean; meldung?: string };

export async function topJetztAbrufen(): Promise<TopState> {
  const { topAbrufen } = await import("@/lib/mz/abruf/top");
  const r = await topAbrufen(getDb(), { manuell: true });
  revalidatePath("/top10");
  return r;
}
