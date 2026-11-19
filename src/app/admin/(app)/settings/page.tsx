import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth";
import { emailConfigSummary } from "@/lib/email";
import { getAllSettings, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/utils";
import { SettingsForms } from "./settings-forms";

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const settings = await getAllSettings();
  const email = emailConfigSummary();
  const checks = [
    { label: "APP_URL", ok: Boolean(process.env.APP_URL), value: appUrl(), hint: "Used in QR codes and email links. Set it to your Railway domain." },
    { label: "SESSION_SECRET", ok: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32), value: process.env.SESSION_SECRET ? "set" : "missing", hint: "Long random string; signs login cookies." },
    { label: "Email transport", ok: email.mode === "smtp", value: email.mode === "smtp" ? `SMTP ${email.host ?? ""}:${email.port ?? ""}` : "console (not sending)", hint: "Set EMAIL_TRANSPORT=smtp plus SMTP_HOST/PORT/USER/PASS and EMAIL_FROM." },
    { label: "CRON_SECRET", ok: Boolean(process.env.CRON_SECRET), value: process.env.CRON_SECRET ? "set" : "missing", hint: "Needed only for automatic HR digests." },
  ];
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Portal-wide defaults and environment checks."
        actions={
          admin.role === "ADMIN" ? (
            <Link href="/admin/settings/users" className="btn-secondary">
              Manage admin users →
            </Link>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
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
          <p className="mt-3 text-xs text-slate-500">Environment variables are set in the Railway service&apos;s Variables tab; the app restarts automatically.</p>
        </section>
        <SettingsForms isAdmin={admin.role === "ADMIN"} defaultHrEmails={settings[SETTING_KEYS.defaultHrEmails] ?? ""} companyName={settings[SETTING_KEYS.companyName] ?? ""} adminEmail={admin.email} />
      </div>
    </div>
  );
}
