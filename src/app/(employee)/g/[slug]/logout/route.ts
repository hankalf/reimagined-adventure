import { NextResponse, type NextRequest } from "next/server";
import { EMPLOYEE_COOKIE } from "@/lib/auth";

export async function GET(request: NextRequest, ctx: RouteContext<"/g/[slug]/logout">) {
  const { slug } = await ctx.params;
  const res = NextResponse.redirect(new URL(`/g/${slug}`, request.nextUrl.origin));
  res.cookies.delete(EMPLOYEE_COOKIE);
  return res;
}
