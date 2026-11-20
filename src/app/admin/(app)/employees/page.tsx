import Link from "next/link";
import { PageHeader, Stat } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { deleteEmployeeAction, toggleEmployeeActiveAction } from "./actions";
import { EmployeeForm } from "./employee-form";
import { ImportForm } from "./import-form";
import { employeeListWhere } from "@/lib/employee-import";

export default async function EmployeesPage({ searchParams }: PageProps<"/admin/employees">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const showInactive = sp.inactive === "1";
  const editId = typeof sp.edit === "string" ? sp.edit : null;
  const [employees, total, active] = await Promise.all([
    db.employee.findMany({
      where: employeeListWhere({ q, includeInactive: showInactive }),
      include: { _count: { select: { selections: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    }),
    db.employee.count(),
    db.employee.count({ where: { active: true } }),
  ]);
  const editing = editId ? employees.find((e) => e.id === editId) ?? (await db.employee.findUnique({ where: { id: editId } })) : null;
  const exportQuery = new URLSearchParams({ ...(q ? { q } : {}), ...(showInactive ? { inactive: "1" } : {}) }).toString();
  const exportHref = `/api/employees/export${exportQuery ? `?${exportQuery}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Employees"
        description="The master list employees are validated against when they enter their employee number and last name."
        actions={
          <a href={exportHref} className="btn-secondary" data-employee-export title={q || showInactive ? "Exports the list as currently filtered" : "Exports all active employees"}>
            ⬇ Export to Excel{q || showInactive ? " (filtered)" : ""}
          </a>
        }
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Active employees" value={active} />
        <Stat label="Total on file" value={total} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Import from Excel or CSV</h2>
          <ImportForm />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">{editing ? `Edit ${editing.firstName} ${editing.lastName}` : "Add one employee"}</h2>
          <EmployeeForm key={editing?.id ?? "new"} initial={editing ?? undefined} />
          {editing && (
            <Link href="/admin/employees" className="mt-2 inline-block text-xs text-slate-500 hover:underline">
              Cancel editing
            </Link>
          )}
        </section>
      </div>

      <form className="mt-6 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Search number, name or department" className="input sm:max-w-xs" />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="inactive" value="1" defaultChecked={showInactive} className="h-4 w-4" /> Show inactive
        </label>
        <button className="btn-secondary">Search</button>
      </form>

      <div className="card mt-3 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Employee #</th>
              <th>Name</th>
              <th>Department</th>
              <th>Gifts chosen</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  No employees match. Import a CSV or add one above.
                </td>
              </tr>
            )}
            {employees.map((e) => (
              <tr key={e.id} className={e.active ? "" : "opacity-60"}>
                <td className="font-mono">{e.employeeNumber}</td>
                <td>
                  {e.firstName} {e.lastName}
                </td>
                <td className="text-slate-600">{e.department ?? "—"}</td>
                <td className="text-slate-600">{e._count.selections}</td>
                <td>{e.active ? <span className="badge bg-emerald-100 text-emerald-800">Active</span> : <span className="badge bg-slate-200 text-slate-700">Inactive</span>}</td>
                <td>
                  <div className="flex justify-end gap-1">
                    <Link href={`/admin/employees?edit=${e.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="btn-ghost btn-sm">
                      Edit
                    </Link>
                    <form action={toggleEmployeeActiveAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <button className="btn-ghost btn-sm">{e.active ? "Deactivate" : "Activate"}</button>
                    </form>
                    <form action={deleteEmployeeAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <button className="btn-ghost btn-sm text-red-700">{e._count.selections > 0 ? "Remove" : "Delete"}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 500 && <p className="p-3 text-xs text-slate-500">Showing the first 500 matches. Narrow your search to see more, or use Export to Excel for the full list.</p>}
      </div>
    </div>
  );
}
