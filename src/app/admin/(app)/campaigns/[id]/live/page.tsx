import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { eligibleEmployees } from "@/lib/report";
import { liveStats } from "@/lib/live";
import { fmtDate } from "@/lib/utils";
import { AutoRefresh } from "@/components/auto-refresh";

// Single-series chart colour (validated default palette, series 1) and recessive ink.
const SERIES = "#2a78d6";
const TRACK = "#e2e8f0";

export default async function LiveProgressPage({ params }: PageProps<"/admin/campaigns/[id]/live">) {
  await requireAdmin();
  const { id } = await params;
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id } });
  const [eligible, selections] = await Promise.all([
    eligibleEmployees(campaign),
    db.selection.findMany({
      where: { campaignId: id },
      select: {
        employeeId: true,
        status: true,
        firstSelectedAt: true,
        selectedAt: true,
        item: { select: { name: true } },
        employee: { select: { firstName: true, lastName: true, department: true } },
      },
    }),
  ]);
  const now = new Date();
  const s = liveStats({
    eligible: eligible.map((e) => ({ employeeId: e.employee.id, department: e.employee.department })),
    selections: selections.map((x) => ({
      employeeId: x.employeeId,
      status: x.status,
      firstSelectedAt: x.firstSelectedAt,
      selectedAt: x.selectedAt,
      itemName: x.item.name,
      firstName: x.employee.firstName,
      lastName: x.employee.lastName,
      department: x.employee.department,
    })),
    now,
  });
  const maxHour = Math.max(1, ...s.byHour.map((h) => h.count));
  const peak = s.byHour.reduce((best, h, i) => (h.count > s.byHour[best].count ? i : best), 0);
  const maxGift = Math.max(1, ...s.topGifts.map((g) => g.count));
  const CHART_H = 140;

  return (
    <div className="space-y-6" data-live>
      <AutoRefresh seconds={30} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <span>
          <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500 align-middle" aria-hidden />
          Live · updated {fmtDate(now, true)} · refreshes every 30 seconds
        </span>
        {campaign.status !== "OPEN" && <span className="badge bg-amber-100 text-amber-800">Campaign is {campaign.status.toLowerCase()}</span>}
      </div>

      {/* Hero figure + KPI row */}
      <section className="grid gap-4 lg:grid-cols-[1.3fr_2fr]">
        <div className="card p-5" data-live-hero>
          <p className="text-sm font-medium text-slate-600">Employees who have picked</p>
          <p className="mt-1 text-6xl font-bold tracking-tight text-slate-900">{s.pct}%</p>
          <p className="mt-1 text-sm text-slate-600">
            <strong className="text-slate-900">{s.picked}</strong> of {s.eligible} eligible
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: TRACK }} role="progressbar" aria-valuenow={s.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Share of employees who have picked">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.pct)}%`, background: SERIES }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Still to pick", value: s.notPicked, href: `/admin/campaigns/${id}/not-picked` },
            { label: "Picks in the last hour", value: s.lastHour },
            { label: "Picks today (ET)", value: s.today },
            { label: "Need a re-pick", value: s.repick, warn: s.repick > 0, href: `/admin/campaigns/${id}/employees?filter=repick` },
          ].map((k) => (
            <div key={k.label} className="card p-4" data-live-kpi={k.label}>
              <p className="text-xs font-medium text-slate-600">{k.label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {k.warn && (
                  <span className="mr-1 text-xl text-amber-600" aria-label="Needs attention">
                    ⚠
                  </span>
                )}
                {k.value}
              </p>
              {k.href && (
                <Link href={k.href} className="text-xs text-blue-700 hover:underline">
                  {k.label === "Still to pick" ? "Print list by department" : "See who"}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Picks per hour */}
      <section className="card p-5" data-live-hours>
        <h2 className="font-semibold">New picks per hour</h2>
        <p className="text-xs text-slate-500">Last 12 hours, Eastern Time. First picks only (changes aren&apos;t counted again).</p>
        <div className="mt-4 flex items-end gap-[2px] border-b border-slate-300" style={{ height: CHART_H + 18 }} role="img" aria-label={`New picks per hour: ${s.byHour.map((h) => `${h.label} ${h.count}`).join(", ")}`}>
          {s.byHour.map((h, i) => {
            const height = h.count === 0 ? 0 : Math.max(3, Math.round((h.count / maxHour) * CHART_H));
            const label = h.count > 0 && (i === peak || h.current);
            return (
              <div key={h.start.toISOString()} className="group flex h-full flex-1 flex-col items-center justify-end" title={`${h.label}${h.current ? " (this hour so far)" : ""}: ${h.count} new pick${h.count === 1 ? "" : "s"}`} data-live-hour={h.count}>
                <span className={`mb-0.5 text-xs font-semibold text-slate-700 ${label ? "" : "invisible group-hover:visible"}`}>{h.count}</span>
                <div className="w-full max-w-[24px] rounded-t-[4px]" style={{ height, background: SERIES, opacity: h.current ? 0.75 : 1 }} />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-[2px] text-[11px] text-slate-500">
          {s.byHour.map((h, i) => (
            <span key={h.start.toISOString()} className="flex-1 text-center">
              {i % 2 === s.byHour.length % 2 || h.current ? h.label : ""}
            </span>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Departments */}
        <section className="card p-5" data-live-departments>
          <h2 className="font-semibold">By department</h2>
          <p className="text-xs text-slate-500">Lowest first, so you can see who needs a reminder.</p>
          {s.byDepartment.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No eligible employees yet.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1 font-medium">Department</th>
                  <th className="py-1 font-medium">Picked</th>
                  <th className="w-2/5 py-1 font-medium">
                    <span className="sr-only">Progress</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.byDepartment.map((d) => (
                  <tr key={d.department} className="border-t border-slate-100" data-live-dept={d.department} title={`${d.department}: ${d.picked} of ${d.eligible} picked (${d.pct}%)`}>
                    <td className="py-2 pr-2 font-medium text-slate-800">{d.department}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-600">
                      {d.picked}/{d.eligible} · <span className="font-semibold text-slate-900">{d.pct}%</span>
                    </td>
                    <td className="py-2">
                      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: TRACK }}>
                        <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: SERIES }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Top gifts */}
        <section className="card p-5" data-live-gifts>
          <h2 className="font-semibold">Most picked gifts</h2>
          <p className="text-xs text-slate-500">Current picks (not counting re-picks still to make).</p>
          {s.topGifts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No picks yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {s.topGifts.map((g) => (
                <li key={g.name} title={`${g.name}: ${g.count}`} data-live-gift={g.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-slate-800">{g.name}</span>
                    <span className="font-semibold text-slate-900">{g.count}</span>
                  </div>
                  <div className="mt-1 h-2 w-full">
                    <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(2, (g.count / maxGift) * 100)}%`, background: SERIES }} />
                  </div>
                </li>
              ))}
              {s.moreGifts > 0 && <li className="text-xs text-slate-500">+ {s.moreGifts} more gift{s.moreGifts === 1 ? "" : "s"}</li>}
            </ul>
          )}
        </section>
      </div>

      {/* Latest activity */}
      <section className="card p-5" data-live-recent>
        <h2 className="font-semibold">Latest picks</h2>
        {s.recent.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nothing yet. Picks appear here within 30 seconds.</p>
        ) : (
          <table className="table mt-2">
            <thead>
              <tr>
                <th>Time (ET)</th>
                <th>Employee</th>
                <th>Department</th>
                <th>Gift</th>
              </tr>
            </thead>
            <tbody>
              {s.recent.map((r, i) => (
                <tr key={`${r.at.toISOString()}-${i}`}>
                  <td className="whitespace-nowrap text-slate-600">{fmtDate(r.at, true)}</td>
                  <td className="font-medium">{r.name}</td>
                  <td className="text-slate-600">{r.department ?? "—"}</td>
                  <td>
                    {r.gift}
                    {r.changed && <span className="ml-2 badge bg-slate-100 text-slate-600">changed</span>}
                    {r.repick && <span className="ml-2 badge bg-amber-100 text-amber-800">⚠ must re-pick</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
