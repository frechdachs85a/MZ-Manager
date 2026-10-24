import { NextResponse, type NextRequest } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// Alles außer Login und Icons ist nur mit gültiger Session erreichbar.
export function proxy(request: NextRequest) {
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
    "/((?!login|_next/static|_next/image|icons/|apple-touch-icon.png|favicon.png).*)",
  ],
};
