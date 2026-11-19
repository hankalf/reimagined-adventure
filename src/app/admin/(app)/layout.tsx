import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/nav";

// Admin pages are per-user and read the database on every request; never prerender them at build time.
export const dynamic = "force-dynamic";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (admin.mustChangePassword) redirect("/admin/change-password");
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="text-xl">🎁</span> Gift Portal <span className="badge bg-slate-100 text-slate-600">Admin</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">
              {admin.name} <span className="text-slate-400">({admin.role})</span>
            </span>
            <Link href="/admin/change-password" className="btn-ghost btn-sm">
              Change password
            </Link>
            <a href="/admin/logout" className="btn-secondary btn-sm">
              Sign out
            </a>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row">
        <aside className="md:w-52 md:shrink-0">
          <AdminNav role={admin.role} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
