import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildEmployeeListWorkbook, employeeListWhere } from "@/lib/employee-import";

export const dynamic = "force-dynamic";

/**
 * Current employee list as Excel, matching the Employees page filters: ?q= (search) and ?inactive=1
 * (include inactive). Admins only.
 */
export async function GET(request: NextRequest) {
  if (!(await getAdmin())) return new NextResponse("Unauthorized", { status: 401 });
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const includeInactive = request.nextUrl.searchParams.get("inactive") === "1";
  const employees = await db.employee.findMany({
    where: employeeListWhere({ q, includeInactive }),
    include: { _count: { select: { selections: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const filter = [q ? `search “${q}”` : "", includeInactive ? "including inactive" : "active only"].filter(Boolean).join(", ");
  const buf = await buildEmployeeListWorkbook(
    employees.map((e) => ({ employeeNumber: e.employeeNumber, firstName: e.firstName, lastName: e.lastName, department: e.department, email: e.email, active: e.active, giftsChosen: e._count.selections, createdAt: e.createdAt })),
    { filter },
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="employees-${stamp}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
