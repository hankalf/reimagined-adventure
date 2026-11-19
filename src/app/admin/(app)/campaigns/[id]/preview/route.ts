import { NextResponse, type NextRequest } from "next/server";
import { EMPLOYEE_COOKIE, getAdmin, signPreviewToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/public-url";
import { eligibleEmployees } from "@/lib/report";

export const dynamic = "force-dynamic";

/** Open the employee pages as a chosen (or the first eligible) employee, in preview mode: nothing is saved. */
export async function GET(request: NextRequest, ctx: RouteContext<"/admin/campaigns/[id]/preview">) {
  if (!(await getAdmin())) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) return new NextResponse("Not found", { status: 404 });
  const employeeId = request.nextUrl.searchParams.get("employeeId");
  let employee = employeeId ? await db.employee.findUnique({ where: { id: employeeId } }) : null;
  if (!employee) employee = (await eligibleEmployees(campaign))[0]?.employee ?? null;
  if (!employee) return NextResponse.redirect(publicUrl(request, `/admin/campaigns/${id}/employees?error=${encodeURIComponent("Add at least one employee before previewing.")}`));
  const token = await signPreviewToken({ employeeId: employee.id, campaignId: campaign.id });
  const page = request.nextUrl.searchParams.get("page") === "pick" ? `/g/${campaign.slug}/pick` : `/g/${campaign.slug}?preview=1`;
  const res = NextResponse.redirect(publicUrl(request, page));
  res.cookies.set(EMPLOYEE_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 2 * 60 * 60 });
  return res;
}
