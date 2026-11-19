export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "default" | "warn" | "good" }) {
  const toneClass = tone === "warn" ? "text-amber-700" : tone === "good" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <div className="text-3xl">🗂️</div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {body && <p className="max-w-md text-sm text-slate-600">{body}</p>}
      {action}
    </div>
  );
}
