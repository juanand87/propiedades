import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSiteUrl } from "./src/lib/siteUrl";

// Only this project's domains are served. Indexing is opt-in after launch review.
export function middleware(request: NextRequest) {
  getSiteUrl(); // Rechazar una configuración que todavía apunte a MundoBeat.
  if (
    /mundobeat|clownfish-app-x3a5k|tiendas-chi/i.test(request.nextUrl.hostname)
  ) {
    return new NextResponse("Dominio ajeno a Propiedades", { status: 421 });
  }
  const response = NextResponse.next();
  if (
    process.env.SITE_INDEX_ENABLED !== "true" ||
    /^\/(panel|dashboard|api|cuenta|favoritos|login|register)(\/|$)/.test(
      request.nextUrl.pathname,
    )
  )
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("X-Project", "propiedades");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
