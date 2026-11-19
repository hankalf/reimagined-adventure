import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { buildTemplateWorkbook, templateRows } from "@/lib/item-import";

export const dynamic = "force-dynamic";

/** Downloadable template for the gift catalog import: ?format=xlsx (default) or ?format=csv. Admins only. */
export async function GET(request: NextRequest) {
  if (!(await getAdmin())) return new NextResponse("Unauthorized", { status: 401 });
  if (request.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(toCsv(templateRows()), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="gift-catalog-template.csv"', "cache-control": "no-store" },
    });
  }
  const buf = await buildTemplateWorkbook();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="gift-catalog-template.xlsx"',
      "cache-control": "no-store",
    },
  });
}
