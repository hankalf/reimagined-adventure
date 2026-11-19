import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/utils";
import { deleteUserAction, toggleUserActiveAction } from "../actions";
import { ResendInviteButton, UserForm } from "./user-forms";

export default async function UsersPage({ searchParams }: PageProps<"/admin/settings/users">) {
  const admin = await requireAdmin({ role: "ADMIN" });
  const sp = await searchParams;
  const users = await db.adminUser.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  const editing = typeof sp.edit === "string" ? users.find((u) => u.id === sp.edit) ?? null : null;
  const activeAdmins = users.filter((u) => u.role === "ADMIN" && u.active).length;

  return (
    <div>
      <PageHeader title="Admin users" description="People who can sign in to this admin. ADMIN can do everything; HR can manage campaigns, orders and emails but not users or settings." />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="font-semibold">{editing ? `Edit ${editing.name}` : "Add a user"}</h2>
          <p className="mt-1 text-xs text-slate-500">{editing ? "Change their name, email or role." : "They receive an email with a link to choose their own password. The link is also shown here to copy."}</p>
          <UserForm key={editing?.id ?? "new"} initial={editing ? { id: editing.id, name: editing.name, email: editing.email, role: editing.role } : undefined} />
          {editing && (
            <Link href="/admin/settings/users" className="mt-2 inline-block text-xs text-slate-500 hover:underline">
              Cancel editing
            </Link>
          )}
        </section>
        <section className="card overflow-x-auto lg:col-span-2">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last sign in</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === admin.id;
                const lastAdmin = u.role === "ADMIN" && u.active && activeAdmins <= 1;
                return (
                  <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                    <td>
                      <div className="font-medium">
                        {u.name} {isSelf && <span className="text-xs text-slate-500">(you)</span>}
                      </div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td>
                      <span className={`badge ${u.role === "ADMIN" ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700"}`}>{u.role}</span>
                    </td>
                    <td>
                      {!u.passwordHash ? (
                        <span className="badge bg-amber-100 text-amber-800">Invited · no password yet</span>
                      ) : u.active ? (
                        <span className="badge bg-emerald-100 text-emerald-800">Active</span>
                      ) : (
                        <span className="badge bg-slate-200 text-slate-700">Deactivated</span>
                      )}
                    </td>
                    <td className="text-xs text-slate-600">{fmtDate(u.lastLoginAt, true)}</td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Link href={`/admin/settings/users?edit=${u.id}`} className="btn-ghost btn-sm">
                          Edit
                        </Link>
                        <ResendInviteButton id={u.id} label={u.passwordHash ? "Send reset link" : "Resend invite"} />
                        {!isSelf && (
                          <form action={toggleUserActiveAction}>
                            <input type="hidden" name="id" value={u.id} />
                            <button className="btn-ghost btn-sm" disabled={lastAdmin}>
                              {u.active ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                        )}
                        {!isSelf && !lastAdmin && (
                          <form action={deleteUserAction}>
                            <input type="hidden" name="id" value={u.id} />
                            <button className="btn-ghost btn-sm text-red-700">Delete</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="p-3 text-xs text-slate-500">The last active ADMIN cannot be deleted or deactivated, and you cannot change your own role.</p>
        </section>
      </div>
    </div>
  );
}
