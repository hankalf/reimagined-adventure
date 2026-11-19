import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { publicUrl } from "@/lib/public-url";

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
    return NextResponse.redirect(publicUrl(request, pathname !== "/admin" ? `/admin/login?next=${encodeURIComponent(pathname)}` : "/admin/login"));
  }
  if (pathname.startsWith("/admin/settings/users") && role !== "ADMIN") {
    return NextResponse.redirect(publicUrl(request, "/admin?forbidden=1"));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
