import { getDb } from "@/lib/db";

// Gesundheitsprüfung für den Hoster (ohne Login): Server läuft und die Datenbank antwortet. Gibt nichts preis.
export async function GET() {
  getDb().prepare("SELECT 1").get();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
