import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/set-password", "/admin/logout"];

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) return new TextEncoder().encode("dev-only-insecure-secret-0123456789");
  return new TextEncoder().encode(secret);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const token = request.cookies.get("gp_admin")?.value;
  let role: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey());
      if (payload.kind === "admin" && typeof payload.sub === "string") role = String(payload.role ?? "ADMIN");
    } catch {
      role = null;
    }
  }
  if (!role) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    if (pathname !== "/admin") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin/settings/users") && role !== "ADMIN") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "?forbidden=1";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
