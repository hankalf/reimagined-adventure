"use client";

import { useFormStatus } from "react-dom";
import { cn, SELECTION_STATUS_LABEL } from "@/lib/utils";

export function SubmitButton({ children, className, pendingText, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(className ?? "btn-primary")} {...rest}>
      {pending ? pendingText ?? "Working…" : children}
    </button>
  );
}

export function Alert({ kind = "info", children, className }: { kind?: "info" | "error" | "success" | "warning"; children: React.ReactNode; className?: string }) {
  const styles = {
    info: "bg-blue-50 text-blue-900 border-blue-200",
    error: "bg-red-50 text-red-900 border-red-200",
    success: "bg-emerald-50 text-emerald-900 border-emerald-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cn("rounded-lg border px-4 py-3 text-sm", styles, className)}>
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  SELECTED: "bg-blue-100 text-blue-800",
  NEEDS_REPICK: "bg-amber-100 text-amber-800",
  ORDERED: "bg-violet-100 text-violet-800",
  RECEIVED: "bg-teal-100 text-teal-800",
  COLLECTED: "bg-emerald-100 text-emerald-800",
  DRAFT: "bg-slate-100 text-slate-700",
  OPEN: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-slate-200 text-slate-700",
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  OUT_OF_STOCK: "bg-red-100 text-red-800",
  SENT: "bg-emerald-100 text-emerald-800",
  LOGGED: "bg-slate-100 text-slate-700",
  FAILED: "bg-red-100 text-red-800",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={cn("badge", STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700")}>{label ?? SELECTION_STATUS_LABEL[status] ?? status.replace(/_/g, " ")}</span>;
}

export function ConfirmButton({ message, children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { message: string }) {
  return (
    <button
      {...rest}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
