import { getDb } from "@/lib/db";
import { ladeFortschritt } from "@/lib/db/taktik";

// Fortschritt der laufenden Editor-Aktion (nur mit App-Login, siehe proxy.ts); die Taktikseite fragt ihn während der
// Aktion jede Sekunde ab.
export async function GET() {
  return Response.json(ladeFortschritt(getDb()), { headers: { "Cache-Control": "no-store" } });
}
