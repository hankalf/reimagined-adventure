"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { seg: "", label: "Overview" },
  { seg: "items", label: "Gifts shown" },
  { seg: "employees", label: "Employees" },
  { seg: "orders", label: "Orders" },
  { seg: "budget", label: "Budget" },
  { seg: "emails", label: "HR emails & Excel" },
  { seg: "branding", label: "Branding & text" },
  { seg: "settings", label: "Settings" },
];

export function CampaignTabs({ id, badges }: { id: string; badges?: Record<string, number> }) {
  const pathname = usePathname();
  const base = `/admin/campaigns/${id}`;
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname.startsWith(href) : pathname === base;
        const badge = badges?.[t.seg];
        return (
          <Link
            key={t.seg}
            href={href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
            )}
          >
            {t.label}
            {badge ? <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
