"use client";

import { useSyncExternalStore } from "react";
import { formatDateTime } from "@/i18n";

const subscribe = () => () => {};

/**
 * A date and time shown in the viewer's own time zone (their phone's), e.g. "Dec 1, 3:45 PM".
 * The server doesn't know that zone, so it renders `fallback` and the browser swaps in local time on hydration.
 */
export function LocalTime({ iso, lang, fallback }: { iso: string; lang: string; fallback: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => formatDateTime(iso, lang),
    () => fallback,
  );
  return (
    <time dateTime={iso} data-local-time className="font-semibold whitespace-nowrap">
      {text}
    </time>
  );
}
