"use client";

import { useState } from "react";

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <div className="flex gap-1">
        <input readOnly value={value} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="btn-secondary btn-sm whitespace-nowrap"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              // ignore
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
