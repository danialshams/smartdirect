import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import type { JWT } from "next-auth/jwt";

type NextAuthRequest = NextRequest & {
  nextauth: {
    token: (JWT & { role?: "ADMIN" | "USER"; id?: string }) | null;
  };
};

export default withAuth(async function middleware(req: NextAuthRequest) {
  const token = req.nextauth.token;
  const path = req.nextUrl.pathname;

  if (path.startsWith("/admin") && token?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
