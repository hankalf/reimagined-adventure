import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/admin/login", request.nextUrl.origin));
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
export const POST = GET;
