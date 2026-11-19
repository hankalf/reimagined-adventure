import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildNotPickedByDepartmentWorkbook, buildOrdersWorkbook } from "@/lib/excel";
import { budgetCsv, buildReportData, detailCsv, notPickedCsv, summaryCsv } from "@/lib/report";

export const dynamic = "force-dynamic";

/**
 * Admin downloads: /api/export/{campaignId}?type=xlsx|summary|detail|budget|notpicked
 * Protected by the admin session cookie.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/export/[campaignId]">) {
  const admin = await getAdmin();
  if (!admin) return new NextResponse("Unauthorized", { status: 401 });
  const { campaignId } = await ctx.params;
  const campaign = await db.campaign.findUnique({ where: { id: campaignId }, select: { id: true, slug: true } });
  if (!campaign) return new NextResponse("Not found", { status: 404 });
  const type = request.nextUrl.searchParams.get("type") ?? "xlsx";
  const onlyNew = false;
  const data = await buildReportData(campaign.id);
  const stamp = data.generatedAt.toISOString().slice(0, 10);

  if (type === "notpicked-xlsx") {
    const buf = await buildNotPickedByDepartmentWorkbook(data);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${campaign.slug}-reminders-by-department-${stamp}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  }
  if (type === "xlsx") {
    const buf = await buildOrdersWorkbook(data, { onlyNew });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${campaign.slug}-orders-${stamp}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  }
  const csv =
    type === "summary" ? summaryCsv(data, onlyNew) : type === "detail" ? detailCsv(data, onlyNew) : type === "budget" ? budgetCsv(data) : type === "notpicked" ? notPickedCsv(data) : null;
  if (csv === null) return new NextResponse("Unknown export type", { status: 400 });
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${campaign.slug}-${type}-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
