"use client";

import { useEffect, useState } from "react";

const KEY = "gp_a11y";
type Prefs = { large: boolean; contrast: boolean };

function apply(p: Prefs) {
  document.documentElement.classList.toggle("a11y-large", p.large);
  document.documentElement.classList.toggle("a11y-contrast", p.contrast);
}

/** Larger text and high-contrast switches; remembered per device in localStorage. */
export function A11yToggle({ labels, dark = false }: { labels: { largerText: string; normalText: string; highContrast: string; normalContrast: string }; dark?: boolean }) {
  const [prefs, setPrefs] = useState<Prefs>({ large: false, contrast: false });
  useEffect(() => {
    // Deferred so the saved preference is applied after hydration without a synchronous state update in the effect.
    const timer = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Prefs | null;
        if (saved) {
          setPrefs(saved);
          apply(saved);
        }
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  function update(next: Prefs) {
    setPrefs(next);
    apply(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  // 36 px minimum so the buttons are easy to tap on a phone.
  const base = "flex min-h-9 min-w-9 items-center justify-center rounded-full border px-2.5 text-xs";
  const cls = dark ? `${base} border-slate-600 text-slate-200 hover:bg-slate-800` : `${base} border-slate-300 text-slate-700 hover:bg-slate-100`;
  return (
    <div className="flex items-center gap-1" data-a11y>
      <button type="button" onClick={() => update({ ...prefs, large: !prefs.large })} className={`${cls} ${prefs.large ? "font-bold" : ""}`} aria-pressed={prefs.large} title={prefs.large ? labels.normalText : labels.largerText}>
        A<span className="text-[0.7em]">A</span>
      </button>
      <button type="button" onClick={() => update({ ...prefs, contrast: !prefs.contrast })} className={`${cls} ${prefs.contrast ? "font-bold" : ""}`} aria-pressed={prefs.contrast} title={prefs.contrast ? labels.normalContrast : labels.highContrast}>
        ◐
      </button>
    </div>
  );
}
