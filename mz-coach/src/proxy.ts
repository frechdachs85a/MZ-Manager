import { NextResponse, type NextRequest } from "next/server";
import { istEingerichtet } from "@/lib/auth/geheimnisse";
import { getSessionSecret, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// Alles außer Login, Einrichtung, Gesundheitsprüfung, Icons, Push-Service-Worker und Manifest ist nur mit gültiger Session erreichbar.
// Ohne App-Passwort (Ersteinrichtung) führt jede Seite zu /einrichtung.
let eingerichtet = false; // einmal eingerichtet, bleibt es so
// Ohne gültige Sitzung zur Anmeldung umleiten
export function proxy(request: NextRequest) {
  if (!eingerichtet && !(eingerichtet = istEingerichtet())) {
    if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "nicht eingerichtet" }, { status: 503 });
    const url = request.nextUrl.clone();
    url.pathname = "/einrichtung";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token, getSessionSecret())) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "nicht angemeldet" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!login|einrichtung|api/gesund|api/fern|_next/static|_next/image|icons/|apple-touch-icon.png|favicon.png|push-sw.js|manifest.webmanifest).*)",
  ],
};
