"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { abrufBeenden, abrufBeginnen } from "@/lib/db/abruf";
import { ladeTeamSpiele } from "@/lib/db/gegner";
import { spielVorhanden } from "@/lib/db/spiele";
import { holeStatsXml } from "@/lib/mz/abruf/spiele";
import { letzteLigaspiele } from "@/lib/mz/parser/spielliste";

export type HolState = { ok?: boolean; meldung?: string };

// Fehlende Ligaspiele ohne Login holen: nacheinander, mit Pause, gespeicherte nie erneut.
export async function fehlendeSpieleHolen(tid: number): Promise<HolState> {
  const db = getDb();
  const { spielXmlEinlesen } = await import("@/lib/mz/abruf/kader");
  const fehlen = letzteLigaspiele(ladeTeamSpiele(db, tid)).filter((s) => !spielVorhanden(db, s.mid));
  if (fehlen.length === 0) return { ok: true, meldung: "Die letzten 8 Ligaspiele sind schon gespeichert." };
  const log = abrufBeginnen(db, "spiele");
  const teile: string[] = [];
  let ok = 0;
  for (const [i, s] of fehlen.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 4000));
    const r = await holeStatsXml(s.mid);
    if (r.ok) {
      spielXmlEinlesen(db, r.xml);
      ok++;
    } else {
      teile.push(`mid ${s.mid}: ${r.text}`);
    }
  }
  const meldung = `${ok} von ${fehlen.length} Spielen geholt.${teile.length ? ` ${teile.join(" ")}` : ""}`;
  abrufBeenden(db, log, ok === fehlen.length, meldung);
  revalidatePath(`/gegner/${tid}`);
  return { ok: ok === fehlen.length, meldung };
}
