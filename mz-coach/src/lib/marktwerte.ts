import type Database from "better-sqlite3";
import { ladeKader } from "@/lib/db/kader";

// Marktwert je pid für die Heatmap: eigener Kader plus alle gespeicherten Kaderseiten anderer Teams
// (Spieltag-Abruf, Wertbereich-Scan). Als einfaches Objekt, damit es auch an Client-Komponenten geht.
export function alleMarktwerte(db: Database.Database): Record<number, number> {
  const out: Record<number, number> = {};
  for (const r of db.prepare("SELECT pid, wert FROM gegner_kader WHERE wert IS NOT NULL").all() as { pid: number; wert: number }[]) out[r.pid] = r.wert;
  for (const k of ladeKader(db)) if (k.marktwert !== undefined) out[k.pid] = k.marktwert;
  return out;
}
