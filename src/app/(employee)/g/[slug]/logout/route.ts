import { NextResponse, type NextRequest } from "next/server";
import { EMPLOYEE_COOKIE } from "@/lib/auth";
import { publicUrl } from "@/lib/public-url";

export async function GET(request: NextRequest, ctx: RouteContext<"/g/[slug]/logout">) {
  const { slug } = await ctx.params;
  const res = NextResponse.redirect(publicUrl(request, `/g/${slug}`));
  res.cookies.delete(EMPLOYEE_COOKIE);
  return res;
}
