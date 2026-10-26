import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { getDb } from "@/lib/db";

// Nach einem Neustart: unterbrochene Abrufe als abgebrochen kennzeichnen (sonst stehen sie ewig auf "läuft") und die
// Markierung "Abruf läuft" (siehe lib/mz/abruf/sitzung.ts) entfernen.
export function nachNeustart() {
  const n = getDb()
    .prepare("UPDATE abruf_log SET beendet = ?, ok = 0, meldung = coalesce(meldung, '') || 'Abgebrochen (Neustart des Servers).' WHERE beendet IS NULL")
    .run(new Date().toISOString()).changes;
  if (n) console.log(`[start] ${n} unterbrochene Abrufe als abgebrochen markiert`);
  rmSync(join(dirname(process.env.DATABASE_PATH ?? "./data/mz-coach.db"), "abruf.laeuft"), { force: true });
}
