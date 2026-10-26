import { getDb } from "@/lib/db";
import { diagnose } from "@/lib/diagnose";
import { fernErlaubt } from "@/lib/fern";

// Diagnose für Claude mit Fernschlüssel (siehe src/lib/fern.ts). Ohne gültigen Schlüssel: 404, verrät nichts.
export async function GET(request: Request) {
  if (!fernErlaubt(request.headers.get("authorization"))) return new Response("nicht gefunden", { status: 404 });
  return Response.json(diagnose(getDb()), { headers: { "Cache-Control": "no-store" } });
}
