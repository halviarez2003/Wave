import { NextResponse } from "next/server";

import { auth } from "@/auth";

const PUBLIC_ROUTES = ["/login"];

// Nota: el archivo se llama `proxy.ts` (no `middleware.ts`) porque Next.js 16
// renombró la convención — ver AGENTS.md / node_modules/next/dist/docs.
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isPublicRoute = PUBLIC_ROUTES.includes(req.nextUrl.pathname);

  if (!isLoggedIn && !isPublicRoute) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isPublicRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
