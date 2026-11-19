import Link from "next/link";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/utils";
import { regenerateFeedTokenAction } from "../../actions";
import { CopyField } from "./copy-field";

export default async function ExportsPage({ params }: PageProps<"/admin/campaigns/[id]/exports">) {
  const { id } = await params;
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id } });
  const base = appUrl();
  const feedXlsx = `${base}/api/feed/${campaign.feedToken}`;
  const feedCsv = `${base}/api/feed/${campaign.feedToken}?format=csv`;
  const feedSummaryCsv = `${base}/api/feed/${campaign.feedToken}?format=csv&sheet=summary`;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-5">
        <h2 className="font-semibold">Excel downloads for this campaign</h2>
        <p className="mt-1 text-xs text-slate-500">The workbook has Summary (grouped by gift with Amazon links), Detail (one row per employee), Budget, Not picked and Info sheets.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`/api/export/${id}?type=xlsx`} className="btn-primary btn-sm">
            ⬇ orders.xlsx
          </a>
          <a href={`/api/export/${id}?type=summary`} className="btn-secondary btn-sm">
            ⬇ Summary CSV
          </a>
          <a href={`/api/export/${id}?type=detail`} className="btn-secondary btn-sm">
            ⬇ Detail CSV
          </a>
          <a href={`/api/export/${id}?type=budget`} className="btn-secondary btn-sm">
            ⬇ Budget CSV
          </a>
          <a href={`/api/export/${id}?type=notpicked`} className="btn-secondary btn-sm">
            ⬇ Not picked CSV
          </a>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Live spreadsheet link (this campaign)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Paste into <strong>Excel → Data → Get Data → From Web</strong> or Google Sheets <code>=IMPORTDATA(&quot;…csv link…&quot;)</code>. Refreshing pulls the latest selections. For one sheet with
          every campaign, and for pushing each order to a sheet automatically, see{" "}
          <Link href="/admin/settings" className="text-blue-700 hover:underline">
            Settings → Orders spreadsheet
          </Link>
          .
        </p>
        <div className="mt-3 space-y-2">
          <CopyField label="Excel workbook (.xlsx)" value={feedXlsx} />
          <CopyField label="Detail CSV (one row per employee)" value={feedCsv} />
          <CopyField label="Summary CSV (grouped by gift)" value={feedSummaryCsv} />
        </div>
        <form action={regenerateFeedTokenAction} className="mt-2">
          <input type="hidden" name="id" value={id} />
          <button className="btn-ghost btn-sm text-red-700">Rotate link (old links stop working)</button>
        </form>
      </section>
    </div>
  );
}
