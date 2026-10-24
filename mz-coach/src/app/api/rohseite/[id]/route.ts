import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ladeRohseite } from "@/lib/db/abruf";

// Download einer gespeicherten ManagerZone-Seite (nur mit App-Login, siehe proxy.ts).
// ?v=roh liefert die Serverantwort, sonst die Seite nach dem JavaScript.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const variante = request.nextUrl.searchParams.get("v") === "roh" ? "roh" : "dom";
  const seite = ladeRohseite(getDb(), Number(id), variante);
  if (!seite) return new Response("nicht vorhanden", { status: 404 });
  return new Response(seite.html, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="mz-rohseite-${Number(id)}-${variante}.html"`,
      "Cache-Control": "no-store",
    },
  });
}
