import { getDb } from "@/lib/db";
import { marktAbrufen, marktFaellig } from "@/lib/mz/abruf/markt";
import { topAbrufen, topFaellig } from "@/lib/mz/abruf/top";

// Prüft alle 15 Minuten, ob ein Abruf fällig ist. Abrufe laufen nie parallel (mitMzSitzung).
const TAKT_MS = 15 * 60 * 1000;
let gestartet = false;
let laeuft = false;

async function takt() {
  if (laeuft) return;
  laeuft = true;
  try {
    const db = getDb();
    if (topFaellig(db)) {
      const r = await topAbrufen(db);
      console.log(`[zeitplan] ${r.meldung.slice(0, 300)}`);
    }
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
  console.log("[zeitplan] aktiv: Top 10 täglich ab 4 Uhr, Transfermarkt ab 6 Uhr (Berlin)");
  setTimeout(takt, 60_000).unref();
  setInterval(takt, TAKT_MS).unref();
}
