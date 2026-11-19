import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth";
import { publicUrl } from "@/lib/public-url";

export async function GET(request: NextRequest) {
  const res = NextResponse.redirect(publicUrl(request, "/admin/login"));
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
export const POST = GET;
