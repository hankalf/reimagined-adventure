import { StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { emailConfigSummary } from "@/lib/email";
import { appUrl, fmtDate } from "@/lib/utils";
import { regenerateFeedTokenAction, toggleDigestAction } from "../../actions";
import { SendEmailForm } from "./send-form";
import { CopyField } from "./copy-field";

export default async function EmailsPage({ params }: PageProps<"/admin/campaigns/[id]/emails">) {
  const { id } = await params;
  const [campaign, logs, newCount] = await Promise.all([
    db.campaign.findUniqueOrThrow({ where: { id } }),
    db.emailLog.findMany({ where: { campaignId: id }, orderBy: { sentAt: "desc" }, take: 30 }),
    db.campaign.findUniqueOrThrow({ where: { id } }).then((c) => db.selection.count({ where: { campaignId: id, status: { not: "NEEDS_REPICK" }, ...(c.lastHrEmailAt ? { selectedAt: { gt: c.lastHrEmailAt } } : {}) } })),
  ]);
  const email = emailConfigSummary();
  const base = appUrl();
  const feedXlsx = `${base}/api/feed/${campaign.feedToken}`;
  const feedCsv = `${base}/api/feed/${campaign.feedToken}?format=csv`;
  const feedSummaryCsv = `${base}/api/feed/${campaign.feedToken}?format=csv&sheet=summary`;
  const cronSet = Boolean(process.env.CRON_SECRET);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Email the order list to HR</h2>
          <p className="mt-1 text-xs text-slate-500">
            Sends an HTML summary (grouped by gift with Amazon links and totals, custom gifts, per-employee list) with <strong>orders.xlsx</strong> and two CSVs attached.
          </p>
          {email.mode === "console" && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Email is in <strong>console mode</strong>: messages are recorded in the log below but not delivered. Set <code>EMAIL_TRANSPORT=smtp</code> and the SMTP variables on Railway to send for real.
            </p>
          )}
          <SendEmailForm campaignId={id} defaultTo={campaign.hrEmails.join(", ")} newCount={newCount} lastSent={campaign.lastHrEmailAt?.toISOString() ?? null} />
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Excel downloads</h2>
          <p className="mt-1 text-xs text-slate-500">The workbook has Summary, Detail, Budget, Not picked and Info sheets.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`/api/export/${id}?type=xlsx`} className="btn-primary btn-sm">
              ⬇ orders.xlsx (everything)
            </a>
            <a href={`/api/export/${id}?type=xlsx&new=1`} className="btn-secondary btn-sm">
              ⬇ Only new since last email
            </a>
          </div>

          <h2 className="mt-6 font-semibold">Live spreadsheet link (auto-updating)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Paste one of these into <strong>Excel → Data → Get Data → From Web</strong> or Google Sheets <code>=IMPORTDATA(&quot;…csv link…&quot;)</code>. Refreshing the sheet pulls the latest selections. Anyone with the link can read the data, so rotate it if it leaks.
          </p>
          <div className="mt-3 space-y-2">
            <CopyField label="Excel workbook (.xlsx)" value={feedXlsx} />
            <CopyField label="Detail CSV (one row per employee)" value={feedCsv} />
            <CopyField label="Summary CSV (grouped by gift)" value={feedSummaryCsv} />
          </div>
          <form action={regenerateFeedTokenAction} className="mt-2">
            <input type="hidden" name="id" value={id} />
            <button
              className="btn-ghost btn-sm text-red-700"
            >
              Rotate link (old links stop working)
            </button>
          </form>

          <h2 className="mt-6 font-semibold">Automatic digest</h2>
          <p className="mt-1 text-xs text-slate-500">
            When enabled, a scheduled job emails HR only the <em>new</em> selections (with the Excel workbook) each time it runs. {cronSet ? "" : "Set CRON_SECRET on Railway to enable the scheduler endpoint."}
          </p>
          <form action={toggleDigestAction} className="mt-2 flex items-center gap-2">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="enabled" value={campaign.digestEnabled ? "0" : "1"} />
            <span className={`badge ${campaign.digestEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{campaign.digestEnabled ? "Digest on" : "Digest off"}</span>
            <button className="btn-secondary btn-sm">{campaign.digestEnabled ? "Turn off" : "Turn on"}</button>
          </form>
          <details className="mt-2 text-xs text-slate-600">
            <summary className="cursor-pointer">How to schedule it on Railway</summary>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Add a new service in your Railway project with a cron schedule (e.g. <code>0 14 * * 1-5</code> for 2pm UTC on weekdays).</li>
              <li>
                Have it run: <code className="break-all">curl -fsS -H &quot;Authorization: Bearer $CRON_SECRET&quot; {base}/api/cron/digest</code>
              </li>
              <li>Set the same <code>CRON_SECRET</code> on both services.</li>
            </ol>
          </details>
        </section>
      </div>

      <section className="card overflow-x-auto">
        <div className="p-4">
          <h2 className="font-semibold">Email history</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Sent</th>
              <th>To</th>
              <th>Subject</th>
              <th>Attachments</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  No emails yet.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{fmtDate(l.sentAt, true)}</td>
                <td className="text-slate-600">{l.to.join(", ")}</td>
                <td>
                  <details>
                    <summary className="cursor-pointer">{l.subject}</summary>
                    <iframe title={l.subject} srcDoc={l.body} className="mt-2 h-96 w-full rounded border border-slate-200 bg-white" sandbox="" />
                  </details>
                </td>
                <td className="text-xs text-slate-600">{l.attachments.join(", ") || "—"}</td>
                <td>
                  <StatusBadge status={l.status} label={l.status === "LOGGED" ? "Logged (not sent)" : l.status} />
                  {l.error && <div className="text-xs text-red-700">{l.error}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
