import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, isLang } from "@/i18n";
import { publicOrigin, publicUrl } from "@/lib/public-url";

/** Sets the employee UI language cookie and sends the visitor back where they came from. */
export async function GET(request: NextRequest, ctx: RouteContext<"/g/[slug]/lang">) {
  const { slug } = await ctx.params;
  const set = request.nextUrl.searchParams.get("set");
  const referer = request.headers.get("referer");
  let back = `/g/${slug}`;
  if (referer) {
    try {
      const u = new URL(referer);
      const sameSite = u.origin === request.nextUrl.origin || u.origin === publicOrigin(request);
      if (sameSite && u.pathname.startsWith(`/g/${slug}`) && !u.pathname.endsWith("/lang")) back = u.pathname + u.search;
    } catch {
      // ignore bad referer
    }
  }
  const res = NextResponse.redirect(publicUrl(request, back));
  if (isLang(set)) res.cookies.set(LANG_COOKIE, set, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
