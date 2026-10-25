import { getDb } from "@/lib/db";
import { marktAbrufen, marktFaellig } from "@/lib/mz/abruf/markt";

// Prüft alle 15 Minuten, ob ein Abruf fällig ist. Abrufe laufen nie parallel (mitMzSitzung).
const TAKT_MS = 15 * 60 * 1000;
let gestartet = false;
let laeuft = false;

async function takt() {
  if (laeuft) return;
  laeuft = true;
  try {
    const db = getDb();
    if (marktFaellig(db)) {
      const r = await marktAbrufen(db);
      console.log(`[zeitplan] ${r.meldung}`);
    }
  } catch (e) {
    console.error("[zeitplan]", e instanceof Error ? e.message : e);
  } finally {
    laeuft = false;
  }
}

export function starteZeitplan() {
  if (gestartet) return;
  gestartet = true;
  console.log("[zeitplan] aktiv: Transfermarkt täglich ab 6 Uhr (Berlin)");
  setTimeout(takt, 60_000).unref();
  setInterval(takt, TAKT_MS).unref();
}
