"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Dashboard", icon: "📊", exact: true },
  { href: "/admin/campaigns", label: "Campaigns", icon: "🎯" },
  { href: "/admin/items", label: "Gift catalog", icon: "🎁" },
  { href: "/admin/employees", label: "Employees", icon: "👥" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️", exact: true },
  { href: "/admin/settings/users", label: "Admin users", icon: "🔐", adminOnly: true },
];

export function AdminNav({ role }: { role: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {items
        .filter((i) => !i.adminOnly || role === "ADMIN")
        .map((i) => {
          const active = i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
                active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200",
              )}
            >
              <span aria-hidden>{i.icon}</span>
              {i.label}
            </Link>
          );
        })}
    </nav>
  );
}
