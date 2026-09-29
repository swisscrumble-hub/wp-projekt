import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, pruefeSessionToken } from "@/lib/auth";

// Öffentlich ist nur die Login-Seite und der Login-Endpunkt; alles andere braucht eine gültige Session.
const OEFFENTLICH = ["/", "/api/auth/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF-Schutz zusätzlich zu SameSite=Strict: Schreibende Anfragen nur vom eigenen Host.
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.headers.get("host")) {
      return NextResponse.json({ error: "Ungültiger Ursprung." }, { status: 403 });
    }
  }

  if (OEFFENTLICH.includes(pathname)) return NextResponse.next();
  if (await pruefeSessionToken(request.cookies.get(COOKIE_NAME)?.value)) return NextResponse.next();

  if (/(^|\/)api\//.test(pathname)) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
