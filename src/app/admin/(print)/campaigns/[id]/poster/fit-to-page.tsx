"use client";

import { useEffect, useRef } from "react";

/**
 * Shrinks its content uniformly when it is taller than the sheet, so the poster always prints on one page.
 * The screen sheet and the printed page have the same content box (7.7 × 10.1 in), so the scale measured on
 * screen is the scale that prints. Works on the DOM directly (no React state) and re-measures as images load.
 */
export function FitToPage({ children }: { children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const available = o.clientHeight;
      const needed = i.scrollHeight; // layout height; unaffected by the transform we apply
      const scale = needed > available + 1 ? Math.max(0.5, available / needed) : 1;
      i.style.transform = scale < 1 ? `scale(${scale})` : "";
      i.dataset.fitScale = scale.toFixed(3);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(i);
    window.addEventListener("beforeprint", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("beforeprint", measure);
    };
  }, []);

  return (
    <div ref={outer} className="h-full w-full overflow-hidden">
      <div ref={inner} data-fit-scale="1" className="flex min-h-full flex-col items-center justify-between text-center" style={{ transformOrigin: "top center" }}>
        {children}
      </div>
    </div>
  );
}
