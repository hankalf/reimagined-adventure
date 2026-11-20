import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildReportData } from "@/lib/report";
import { groupNotPickedByDepartment } from "@/lib/not-picked";
import { formatCalendarDate } from "@/lib/time-zone";
import { fmtDate } from "@/lib/utils";
import { PrintButton } from "../poster/print-button";

/** Printable "not picked yet" list by department, for supervisors to remind their people. US Letter. */
export default async function NotPickedPrintPage({ params, searchParams }: PageProps<"/admin/campaigns/[id]/not-picked">) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) notFound();

  const data = await buildReportData(id);
  const repick = new Set(data.detail.filter((d) => d.status === "NEEDS_REPICK").map((d) => d.employeeNumber));
  const allGroups = groupNotPickedByDepartment(data.notPicked.map((p) => ({ ...p, mustRepick: repick.has(p.employeeNumber) })));
  const dept = typeof sp.dept === "string" ? sp.dept : "";
  const pagePerDept = sp.pages !== "0";
  const groups = dept ? allGroups.filter((g) => g.department === dept) : allGroups;
  const shownCount = groups.reduce((n, g) => n + g.people.length, 0);
  const asOf = fmtDate(new Date(), true);
  const deadline = campaign.closesAt ? `Choose by ${formatCalendarDate(campaign.closesAt)} (11:59 PM ET)` : null;

  const sheetHeader = (department: string | null, count: number) => (
    <header className="mb-3 flex items-start justify-between gap-4 border-b-2 pb-2" style={{ borderColor: campaign.primaryColor }}>
      <div className="min-w-0">
        <p className="text-[10pt] font-semibold text-slate-500">{campaign.name}</p>
        <h1 className="text-[18pt] font-black leading-tight" style={{ color: campaign.primaryColor }}>
          Not picked yet{department ? ` — ${department}` : ""}
        </h1>
        <p className="text-[10pt] text-slate-700">
          <strong>{count}</strong> {count === 1 ? "person" : "people"} · as of {asOf}
          {deadline && <> · {deadline}</>}
        </p>
        <p className="mt-1 text-[9.5pt] text-slate-600">Please remind each person to scan the gift poster&apos;s QR code (or this one) with their phone and choose their gift.</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/campaigns/${campaign.slug}/qr?size=320`} alt="QR code" className="h-[0.95in] w-[0.95in] shrink-0" />
    </header>
  );

  const table = (people: (typeof groups)[number]["people"], showDept: boolean) => (
    <table className="w-full border-collapse text-[10.5pt]">
      <thead>
        <tr className="border-b border-slate-400 text-left text-[8.5pt] uppercase tracking-wide text-slate-500">
          <th className="w-[0.4in] py-1">Done</th>
          <th className="w-[1.4in] py-1 pr-3">Employee #</th>
          <th className="py-1 pr-3">Name</th>
          {showDept && <th className="py-1 pr-3">Department</th>}
          <th className="w-[2.1in] py-1">Note</th>
        </tr>
      </thead>
      <tbody>
        {people.map((p) => (
          <tr key={p.employeeNumber} className="break-inside-avoid border-b border-slate-200" data-not-picked-row>
            <td className="py-1.5">
              <span className="inline-block h-[0.17in] w-[0.17in] rounded-sm border border-slate-500 align-middle" />
            </td>
            <td className="py-1.5 pr-3 font-mono">{p.employeeNumber}</td>
            <td className="py-1.5 pr-3 font-semibold">
              {p.lastName}, {p.firstName}
            </td>
            {showDept && <td className="py-1.5 pr-3">{p.department ?? ""}</td>}
            <td className="py-1.5 text-[9.5pt] text-amber-800">{p.mustRepick ? "Must re-pick (gift unavailable)" : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="py-6 print:py-0">
      <style>{`@page { size: letter portrait; margin: 0.5in; }`}</style>

      <form method="get" className="no-print mx-auto mb-4 flex w-[8.5in] max-w-full flex-wrap items-center justify-between gap-3 px-2 text-sm">
        <a href={`/admin/campaigns/${id}/employees`} className="text-blue-700 hover:underline">
          ← Back to employees
        </a>
        <div className="flex flex-wrap items-center gap-2">
          <select name="dept" defaultValue={dept} className="input py-1.5" style={{ width: "auto", maxWidth: "16rem" }} aria-label="Department">
            <option value="">All departments ({data.notPicked.length})</option>
            {allGroups.map((g) => (
              <option key={g.department} value={g.department}>
                {g.department} ({g.people.length})
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5">
            <input type="hidden" name="pages" value="0" />
            <input type="checkbox" name="pages" value="1" defaultChecked={pagePerDept} />
            New page per department
          </label>
          <button className="btn-secondary btn-sm">Update</button>
          <PrintButton />
        </div>
      </form>

      <div data-not-picked-sheet className="print-exact mx-auto w-[8.5in] max-w-full bg-white px-[0.5in] py-[0.5in] shadow-xl print:w-auto print:p-0 print:shadow-none">
        {groups.length === 0 ? (
          <>
            {sheetHeader(dept || null, 0)}
            <p className="py-10 text-center text-[14pt] font-semibold text-slate-700">Everyone has picked their gift. 🎉</p>
          </>
        ) : pagePerDept ? (
          groups.map((g, i) => (
            <section key={g.department} data-not-picked-dept={g.department} style={i > 0 ? { breakBefore: "page" } : undefined} className={i > 0 ? "mt-10 print:mt-0" : ""}>
              {sheetHeader(g.department, g.people.length)}
              {table(g.people, false)}
            </section>
          ))
        ) : (
          <>
            {sheetHeader(dept || null, shownCount)}
            {!dept && (
              <p className="mb-3 text-[9.5pt] text-slate-600">
                {data.counts.notPicked} of {data.counts.eligible} eligible employees haven&apos;t picked:{" "}
                {allGroups.map((g) => `${g.department} ${g.people.length}`).join(" · ")}
              </p>
            )}
            {groups.map((g) => (
              <section key={g.department} data-not-picked-dept={g.department} className="mb-5">
                <h2 className="mb-1 break-after-avoid text-[12pt] font-bold" style={{ color: campaign.primaryColor }}>
                  {g.department} <span className="font-semibold text-slate-500">({g.people.length})</span>
                </h2>
                {table(g.people, false)}
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
