import { NextRequest, NextResponse } from "next/server";
import { verifyAnonJWT } from "@/lib/jwt-token";

const NOT_NEED_AUTH_PATHS = ["/api/parse", "/api/login", "/api/login-wiki"];

export async function middleware(req: NextRequest) {
  for (const path of NOT_NEED_AUTH_PATHS) {
    if (req.nextUrl.pathname.startsWith(path)) {
      return NextResponse.next();
    }
  }
  const token =
    req.cookies.get("anon_jwt")?.value ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!token)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await verifyAnonJWT(token);
    return NextResponse.next();
  } catch (e) {
    return NextResponse.json({ error: "invalid or expired" }, { status: 401 });
  }
}

export const config = { matcher: ["/api/secure/:path*"] };
