import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildGiftLabelsDocx } from "@/lib/gift-labels-docx";
import { isLabelSort, isLabelStatus, labelRows } from "@/lib/gift-labels";

export const dynamic = "force-dynamic";

/**
 * Gift labels for Word on Avery 5960 / 5160 sheets:
 * /api/export/{campaignId}/labels?from=…&status=open|received|ordered|all&sort=dept|name|gift&start=1..30
 * Admins only.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/export/[campaignId]/labels">) {
  const admin = await getAdmin();
  if (!admin) return new NextResponse("Unauthorized", { status: 401 });
  const { campaignId } = await ctx.params;
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, slug: true, primaryColor: true, accentColor: true, logoImageId: true, leadershipName: true, companyName: true },
  });
  if (!campaign) return new NextResponse("Not found", { status: 404 });

  const sp = request.nextUrl.searchParams;
  const from = (sp.get("from") ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || campaign.leadershipName || campaign.companyName || "HR";
  const status = isLabelStatus(sp.get("status")) ? (sp.get("status") as "open") : "open";
  const sort = isLabelSort(sp.get("sort")) ? (sp.get("sort") as "dept") : "dept";
  const start = Math.min(30, Math.max(1, Number.parseInt(sp.get("start") ?? "1", 10) || 1));

  const [selections, logo] = await Promise.all([
    db.selection.findMany({
      where: { campaignId },
      select: {
        status: true,
        option1Value: true,
        option2Value: true,
        employee: { select: { firstName: true, lastName: true, department: true } },
        item: { select: { name: true } },
      },
    }),
    campaign.logoImageId ? db.image.findUnique({ where: { id: campaign.logoImageId }, select: { data: true } }) : Promise.resolve(null),
  ]);

  const rows = labelRows(
    selections.map((s) => ({
      firstName: s.employee.firstName,
      lastName: s.employee.lastName,
      department: s.employee.department,
      status: s.status,
      itemName: s.item.name,
      option1Value: s.option1Value,
      option2Value: s.option2Value,
    })),
    { status, sort },
  );
  const buf = await buildGiftLabelsDocx(rows, {
    from,
    primaryColor: campaign.primaryColor,
    accentColor: campaign.accentColor,
    logo: logo ? Buffer.from(logo.data) : null,
    startAt: start,
  });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${campaign.slug}-gift-labels-avery5960-${stamp}.docx"`,
      "cache-control": "no-store",
      "x-label-count": String(rows.length),
    },
  });
}
