"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { ladeKader } from "@/lib/db/kader";
import { bestaetigeKombi } from "@/lib/scout";

export type ScoutState = { meldung?: string; ok?: boolean };

// Neue Kombination aus Sternen und Schlüsselwort bestätigen. Das Schlüsselwort muss wörtlich im Text des
// Spielers stehen, die Sterne kommen aus seinem gespeicherten Bericht (nichts wird frei eingegeben).
export async function kombiBestaetigen(_prev: ScoutState, formData: FormData): Promise<ScoutState> {
  const pid = Number(formData.get("pid"));
  const rang = Number(formData.get("rang"));
  const schluessel = String(formData.get("schluessel") ?? "").trim();
  const abzeichen = String(formData.get("abzeichen") ?? "").trim();
  const db = getDb();
  const sp = ladeKader(db).find((s) => s.pid === pid);
  if (!sp?.scoutSterne?.hoch || sp.scoutSterne.niedrig === undefined) return { meldung: "Spieler ohne Sterne." };
  if (!Number.isInteger(rang) || rang < 1 || rang > 20) return { meldung: "Rang als ganze Zahl (1 = beste)." };
  if (schluessel.length < 4) return { meldung: "Schlüsselwort fehlt." };
  if (!sp.scoutText?.toLocaleLowerCase("de-DE").includes(schluessel.toLocaleLowerCase("de-DE"))) {
    return { meldung: "Das Schlüsselwort steht so nicht im Text des Scoutberichts." };
  }
  if (!abzeichen) return { meldung: "Abzeichen fehlt (z. B. Weltklasse)." };
  bestaetigeKombi(db, { rang, hoch: sp.scoutSterne.hoch, niedrig: sp.scoutSterne.niedrig, schluessel, abzeichen });
  revalidatePath("/kader");
  revalidatePath("/jugend");
  return { ok: true, meldung: `Bestätigt: ${sp.scoutSterne.hoch}/${sp.scoutSterne.niedrig} „${schluessel}“ = Rang ${rang} (${abzeichen}).` };
}
