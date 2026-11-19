import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { buildAllOrdersWorkbook } from "@/lib/excel";
import { buildReportData, detailCsv } from "@/lib/report";
import { getSetting } from "@/lib/settings";
import { WEBHOOK_KEYS } from "@/lib/webhook";

export const dynamic = "force-dynamic";

/**
 * Live feed of every campaign's orders, for the one spreadsheet HR keeps:
 *   /api/feed/all/{token}            -> orders.xlsx (Orders + Summary sheets)
 *   /api/feed/all/{token}?format=csv -> one CSV row per selection, with a Campaign column
 * The token lives in Settings → Orders spreadsheet.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/feed/all/[token]">) {
  const { token } = await ctx.params;
  const expected = await getSetting(WEBHOOK_KEYS.feedToken);
  if (!expected || !token || token !== expected) return new NextResponse("Not found", { status: 404 });
  const campaigns = await db.campaign.findMany({ orderBy: { createdAt: "desc" }, select: { id: true } });
  const reports = await Promise.all(campaigns.map((c) => buildReportData(c.id)));
  if (request.nextUrl.searchParams.get("format") === "csv") {
    const lines: string[] = [];
    reports.forEach((data, i) => {
      const csv = detailCsv(data).split("\r\n");
      const [header, ...rows] = csv;
      if (i === 0) lines.push(`Campaign,${header}`);
      for (const r of rows) if (r.trim()) lines.push(`"${data.campaign.name.replace(/"/g, '""')}",${r}`);
    });
    return new NextResponse(lines.join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store" } });
  }
  const buf = await buildAllOrdersWorkbook(reports);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'inline; filename="all-orders.xlsx"',
      "cache-control": "no-store",
    },
  });
}
