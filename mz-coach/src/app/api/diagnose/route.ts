import { getDb } from "@/lib/db";
import { diagnose } from "@/lib/diagnose";

// Diagnose zum Herunterladen (nur mit App-Login, siehe proxy.ts). Inhalt: src/lib/diagnose.ts
export async function GET() {
  const datei = diagnose(getDb());
  return new Response(JSON.stringify(datei, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mz-coach-diagnose-${datei.erstellt.slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
