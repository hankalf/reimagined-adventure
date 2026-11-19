import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { buildOrdersWorkbook } from "@/lib/excel";
import { buildReportData, detailCsv, summaryCsv } from "@/lib/report";

export const dynamic = "force-dynamic";

/**
 * Live spreadsheet feed. Each campaign has a secret token; paste the URL into Excel ("Data > From Web")
 * or Google Sheets (=IMPORTDATA("...?format=csv")) and refresh to pull the latest selections.
 *   /api/feed/{token}            -> orders.xlsx (all sheets)
 *   /api/feed/{token}?format=csv -> detail CSV (one row per employee)
 *   /api/feed/{token}?format=csv&sheet=summary -> grouped summary CSV
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/feed/[token]">) {
  const { token } = await ctx.params;
  if (!token || token.length < 16) return new NextResponse("Not found", { status: 404 });
  const campaign = await db.campaign.findUnique({ where: { feedToken: token }, select: { id: true, slug: true } });
  if (!campaign) return new NextResponse("Not found", { status: 404 });
  const data = await buildReportData(campaign.id);
  const format = request.nextUrl.searchParams.get("format") ?? "xlsx";
  if (format === "csv") {
    const sheet = request.nextUrl.searchParams.get("sheet") ?? "detail";
    const csv = sheet === "summary" ? summaryCsv(data) : detailCsv(data);
    return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store" } });
  }
  const buf = await buildOrdersWorkbook(data);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `inline; filename="${campaign.slug}-orders.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
