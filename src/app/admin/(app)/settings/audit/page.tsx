import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActorType } from "@/lib/db";
import { fmtDate } from "@/lib/utils";

const PAGE_SIZE = 50;

export default async function AuditPage({ searchParams }: PageProps<"/admin/settings/audit">) {
  await requireAdmin();
  const sp = await searchParams;
  const actor: ActorType | undefined = sp.actor === "ADMIN" || sp.actor === "EMPLOYEE" || sp.actor === "SYSTEM" ? sp.actor : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const where = {
    ...(actor ? { actorType: actor } : {}),
    ...(q ? { OR: [{ action: { contains: q, mode: "insensitive" as const } }, { entityType: { contains: q, mode: "insensitive" as const } }, { entityId: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.auditLog.count({ where }),
  ]);
  const adminIds = [...new Set(rows.filter((r) => r.actorType === "ADMIN" && r.actorId).map((r) => r.actorId as string))];
  const employeeIds = [...new Set(rows.filter((r) => r.actorType === "EMPLOYEE" && r.actorId).map((r) => r.actorId as string))];
  const [admins, employees] = await Promise.all([
    db.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } }),
    db.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, employeeNumber: true, firstName: true, lastName: true } }),
  ]);
  const who = (r: { actorType: string; actorId: string | null }) => {
    if (!r.actorId) return r.actorType === "SYSTEM" ? "System" : "—";
    if (r.actorType === "ADMIN") return admins.find((a) => a.id === r.actorId)?.name ?? "Admin (deleted)";
    const e = employees.find((x) => x.id === r.actorId);
    return e ? `${e.firstName} ${e.lastName} (${e.employeeNumber})` : "Employee (deleted)";
  };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => `?${new URLSearchParams({ ...(actor ? { actor } : {}), ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Who did what, and when: admin actions, employee picks, and automatic changes."
        actions={
          <Link href="/admin/settings" className="btn-secondary">
            ← Settings
          </Link>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search action, entity or id (e.g. selection, item.price)" className="input sm:max-w-sm" />
        <select name="actor" defaultValue={actor ?? ""} className="input sm:max-w-[160px]">
          <option value="">Everyone</option>
          <option value="ADMIN">Admins</option>
          <option value="EMPLOYEE">Employees</option>
          <option value="SYSTEM">System</option>
        </select>
        <button className="btn-secondary">Filter</button>
        <span className="ml-auto self-center text-sm text-slate-500">{total} entries</span>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  No entries match.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs">{fmtDate(r.createdAt, true)}</td>
                <td className="text-sm">{who(r)}</td>
                <td className="font-mono text-xs">{r.action}</td>
                <td className="text-xs text-slate-600">
                  {r.entityType} <span className="font-mono text-slate-400">{r.entityId.slice(0, 12)}</span>
                </td>
                <td className="max-w-md truncate font-mono text-[11px] text-slate-500" title={r.meta ? JSON.stringify(r.meta) : ""}>
                  {r.meta ? JSON.stringify(r.meta) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-3 text-sm">
          <span className="text-slate-500">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={qs(page - 1)} className="btn-secondary btn-sm">
                ← Newer
              </Link>
            )}
            {page < pages && (
              <Link href={qs(page + 1)} className="btn-secondary btn-sm">
                Older →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
