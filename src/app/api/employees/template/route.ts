import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/auth";
import { buildEmployeeTemplateWorkbook, employeeTemplateCsv, type EmployeeTemplateLayout } from "@/lib/employee-import";

export const dynamic = "force-dynamic";

/**
 * Employee upload templates. ?layout=simple (Employee # + Name "Last, First") or full (default);
 * ?format=xlsx (default) or csv. Admins only.
 */
export async function GET(request: NextRequest) {
  if (!(await getAdmin())) return new NextResponse("Unauthorized", { status: 401 });
  const layout: EmployeeTemplateLayout = request.nextUrl.searchParams.get("layout") === "simple" ? "simple" : "full";
  const name = layout === "simple" ? "employee-list-simple" : "employee-list-template";
  if (request.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(employeeTemplateCsv(layout), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"`, "cache-control": "no-store" },
    });
  }
  const buf = await buildEmployeeTemplateWorkbook(layout);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${name}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
