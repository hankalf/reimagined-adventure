import Link from "next/link";
import { randomBytes } from "node:crypto";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth";
import { getAllSettings, setSetting, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/utils";
import { getWebhookConfig, WEBHOOK_KEYS } from "@/lib/webhook";
import { CopyField } from "@/app/admin/(app)/campaigns/[id]/exports/copy-field";
import { rotateGlobalFeedTokenAction } from "./actions";
import { DefaultsForm, WebhookForm } from "./settings-forms";

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const settings = await getAllSettings();
  let feedToken = settings[WEBHOOK_KEYS.feedToken];
  if (!feedToken) {
    feedToken = randomBytes(24).toString("hex");
    await setSetting(WEBHOOK_KEYS.feedToken, feedToken);
  }
  const webhook = await getWebhookConfig();
  const base = appUrl();
  const checks = [
    { label: "APP_URL", ok: Boolean(process.env.APP_URL), value: base, hint: "Used in QR codes, spreadsheet links and invite emails. Set it to your Railway domain." },
    { label: "SESSION_SECRET", ok: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32), value: process.env.SESSION_SECRET ? "set" : "missing", hint: "Long random string; signs login cookies." },
  ];
  const samplePayload = `{
  "event": "selection.status_changed",
  "sentAt": "2026-12-01T15:04:05.000Z",
  "count": 1,
  "newStatus": "ORDERED",
  "selections": [{
    "campaign": "Holiday Gifts 2026", "employeeNumber": "10001", "firstName": "Maria", "lastName": "García",
    "department": "Operations", "gift": "Insulated Travel Tumbler 40 oz", "options": "Teal", "optionsDetail": "Color: Teal",
    "cost": 45, "status": "ORDERED", "confirmationCode": "A7K2PQ", "productUrl": "https://www.amazon.com/dp/B0BZYCJK89",
    "selectedAt": "…", "orderedAt": "…", "receivedAt": null, "collectedAt": null
  }]
}`;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Portal-wide defaults, the orders spreadsheet connection and environment checks."
        actions={
          admin.role === "ADMIN" ? (
            <Link href="/admin/settings/users" className="btn-secondary">
              Manage admin users →
            </Link>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Orders spreadsheet</h2>
          <p className="mt-1 text-xs text-slate-500">Two ways to keep one Excel or Google sheet in sync with every order, across all campaigns. Use either or both.</p>

          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">1. Live link the sheet pulls from</h3>
              <p className="mt-1 text-xs text-slate-500">
                In Excel: <strong>Data → Get Data → From Web</strong>, paste the .xlsx link, then <strong>Data → Refresh All</strong> (or set it to refresh on open). In Google Sheets:{" "}
                <code>=IMPORTDATA(&quot;…csv link…&quot;)</code>, which refreshes itself. Anyone with the link can read the orders, so rotate it if it leaks.
              </p>
              <div className="mt-3 space-y-2">
                <CopyField label="All campaigns, Excel workbook (.xlsx)" value={`${base}/api/feed/all/${feedToken}`} />
                <CopyField label="All campaigns, CSV (one row per selection)" value={`${base}/api/feed/all/${feedToken}?format=csv`} />
              </div>
              {admin.role === "ADMIN" && (
                <form action={rotateGlobalFeedTokenAction} className="mt-2">
                  <button className="btn-ghost btn-sm text-red-700">Rotate link (old links stop working)</button>
                </form>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold">2. Push every change to the sheet (webhook)</h3>
              <p className="mt-1 text-xs text-slate-500">
                Each time a gift is chosen, changed, ordered, received, collected, reset or re-priced, we POST a JSON event to this URL. Connect it to <strong>Power Automate</strong> (“When an HTTP
                request is received” → “Add a row into a table” for Excel Online), <strong>Zapier</strong> (Webhooks → Google Sheets / Excel) or <strong>Make</strong>, and the sheet fills itself.
              </p>
              <div className="mt-3">
                <WebhookForm isAdmin={admin.role === "ADMIN"} url={webhook.url} secret={webhook.secret} lastStatus={webhook.lastStatus} lastAt={webhook.lastAt} lastError={webhook.lastError} />
              </div>
              <details className="mt-3 text-xs text-slate-600">
                <summary className="cursor-pointer">What the event looks like</summary>
                <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-[11px] text-slate-100">{samplePayload}</pre>
                <p className="mt-1">Headers: <code>x-giftportal-event</code> (event name) and, when a secret is set, <code>x-giftportal-signature: sha256=&lt;HMAC of the body&gt;</code>.</p>
              </details>
            </div>
          </div>
        </section>

        <DefaultsForm isAdmin={admin.role === "ADMIN"} companyName={settings[SETTING_KEYS.companyName] ?? ""} />

        <section className="card p-5">
          <h2 className="font-semibold">Environment</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-3">
                <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${c.ok ? "bg-emerald-500" : "bg-amber-500"}`} />
                <div>
                  <div>
                    <span className="font-mono text-xs">{c.label}</span> · <span className="text-slate-700">{c.value}</span>
                  </div>
                  <div className="text-xs text-slate-500">{c.hint}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Environment variables are set in the Railway service&apos;s Variables tab; the app restarts automatically. SMTP variables are optional and only used to email admin invite and password-reset links.</p>
        </section>
      </div>
    </div>
  );
}
