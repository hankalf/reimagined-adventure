"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { imageSrc } from "@/lib/image-src";
import { ItemThumb } from "@/components/item-thumb";
import { fmtDate, SELECTION_STATUS_LABEL } from "@/lib/utils";
import { kioskCollectAction, kioskLookupAction, kioskSelectionByIdAction, kioskUndoAction, type KioskLookup, type KioskSelection, type KioskStats } from "./actions";
import { Scanner } from "./scanner";

type Props = { campaign: { id: string; name: string; currency: string; primaryColor: string }; initialStats: KioskStats };

type View =
  | { mode: "idle" }
  | { mode: "result"; lookup: KioskLookup }
  | { mode: "collected"; selection: KioskSelection }
  | { mode: "error"; message: string };

const AUTO_RESET_MS = 6000;

function beep(kind: "ok" | "warn") {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = kind === "ok" ? 880 : 220;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (kind === "ok" ? 0.12 : 0.3));
    osc.onended = () => ctx.close();
  } catch {
    // audio is a nicety only
  }
}

export function KioskClient({ campaign, initialStats }: Props) {
  const [stats, setStats] = useState(initialStats);
  const [view, setView] = useState<View>({ mode: "idle" });
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScan = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const reset = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setView({ mode: "idle" });
    setQuery("");
    focusInput();
  }, [focusInput]);

  useEffect(() => {
    focusInput();
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [focusInput]);

  const lookup = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      if (resetTimer.current) clearTimeout(resetTimer.current);
      startTransition(async () => {
        try {
          const result = await kioskLookupAction(campaign.id, text);
          setView({ mode: "result", lookup: result });
          if (result.kind === "none" || result.kind === "no_selection") beep("warn");
        } catch {
          setView({ mode: "error", message: "Lookup failed. Check the connection and try again." });
        }
      });
    },
    [campaign.id],
  );

  const onDecoded = useCallback(
    (text: string) => {
      const now = Date.now();
      if (lastScan.current.text === text && now - lastScan.current.at < 4000) return;
      lastScan.current = { text, at: now };
      setScanning(false);
      setQuery(text);
      lookup(text);
    },
    [lookup],
  );

  const collect = useCallback(
    (selectionId: string) => {
      startTransition(async () => {
        const res = await kioskCollectAction(campaign.id, selectionId);
        setStats(res.stats);
        if (res.ok) {
          beep("ok");
          setView({ mode: "collected", selection: res.selection });
          resetTimer.current = setTimeout(reset, AUTO_RESET_MS);
        } else {
          beep("warn");
          setView({ mode: "error", message: res.error });
        }
      });
    },
    [campaign.id, reset],
  );

  const undo = useCallback(
    (selectionId: string) => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      startTransition(async () => {
        const res = await kioskUndoAction(campaign.id, selectionId);
        setStats(res.stats);
        if (res.ok) setView({ mode: "result", lookup: { kind: "selection", selection: res.selection } });
        else setView({ mode: "error", message: res.error });
      });
    },
    [campaign.id],
  );

  const pickMatch = useCallback(
    (selectionId: string) => {
      startTransition(async () => {
        const sel = await kioskSelectionByIdAction(campaign.id, selectionId);
        setView(sel ? { mode: "result", lookup: { kind: "selection", selection: sel } } : { mode: "error", message: "Not found." });
      });
    },
    [campaign.id],
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-4">
      <header className="flex items-center justify-between gap-3 text-sm text-slate-300">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Pickup kiosk</div>
          <div className="text-lg font-semibold text-white">{campaign.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-slate-800 px-3 py-1.5 text-center">
            <div className="text-xl font-bold text-emerald-400">{stats.collected}</div>
            <div className="text-[10px] uppercase text-slate-400">collected</div>
          </div>
          <div className="rounded-lg bg-slate-800 px-3 py-1.5 text-center">
            <div className="text-xl font-bold text-teal-300">{stats.ready}</div>
            <div className="text-[10px] uppercase text-slate-400">ready</div>
          </div>
          <div className="rounded-lg bg-slate-800 px-3 py-1.5 text-center">
            <div className="text-xl font-bold text-slate-200">{stats.toOrder + stats.ordered}</div>
            <div className="text-[10px] uppercase text-slate-400">not in yet</div>
          </div>
          <Link href={`/admin/campaigns/${campaign.id}/orders`} className="ml-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">
            Exit
          </Link>
        </div>
      </header>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(query);
        }}
      >
        <input
          id="kiosk-query"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Scan or type confirmation code, employee number or name"
          autoComplete="off"
          autoCapitalize="characters"
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-4 text-lg text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
        <button type="submit" disabled={pending} className="rounded-xl bg-slate-700 px-5 text-base font-semibold hover:bg-slate-600 disabled:opacity-50">
          {pending ? "…" : "Find"}
        </button>
        <button
          type="button"
          onClick={() => setScanning((s) => !s)}
          className={`rounded-xl px-5 text-base font-semibold ${scanning ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"}`}
        >
          {scanning ? "Stop" : "📷 Scan"}
        </button>
      </form>
      <p className="mt-2 text-xs text-slate-500">
        Tip: a USB barcode scanner types the code and presses Enter for you. Press Enter again on the result to mark it collected.
      </p>

      {scanning && (
        <div className="mt-4">
          <Scanner onDecoded={onDecoded} onError={(m) => setView({ mode: "error", message: m })} />
        </div>
      )}

      <section className="mt-5 flex-1">
        {view.mode === "idle" && (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 text-center text-slate-400">
            <div className="text-5xl">🎁</div>
            <p className="mt-3">Ask the employee for the QR code on their confirmation page, or their employee number.</p>
          </div>
        )}

        {view.mode === "error" && (
          <div role="alert" className="rounded-2xl border border-red-500/50 bg-red-950/50 p-5 text-red-100">
            <p className="text-lg font-semibold">{view.message}</p>
            <button onClick={reset} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500">
              OK
            </button>
          </div>
        )}

        {view.mode === "collected" && (
          <div role="status" className="rounded-2xl bg-emerald-600 p-6 text-white">
            <div className="text-5xl">✅</div>
            <h2 className="mt-2 text-3xl font-bold">
              Collected — {view.selection.firstName} {view.selection.lastName}
            </h2>
            <p className="mt-1 text-lg text-emerald-100">
              {view.selection.itemName}
              {view.selection.optionText && ` · ${view.selection.optionText}`}
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={reset} autoFocus className="rounded-xl bg-white px-5 py-3 text-base font-semibold text-emerald-700 hover:bg-emerald-50">
                Next person
              </button>
              <button onClick={() => undo(view.selection.id)} className="rounded-xl border border-emerald-300 px-5 py-3 text-base font-semibold text-white hover:bg-emerald-500">
                Undo
              </button>
            </div>
            <p className="mt-3 text-xs text-emerald-200">Resets automatically in a few seconds.</p>
          </div>
        )}

        {view.mode === "result" && view.lookup.kind === "none" && (
          <div className="rounded-2xl border border-amber-500/50 bg-amber-950/40 p-5 text-amber-100">
            <p className="text-lg font-semibold">{view.lookup.message}</p>
            <button onClick={reset} className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500">
              Try again
            </button>
          </div>
        )}

        {view.mode === "result" && view.lookup.kind === "no_selection" && (
          <div className="rounded-2xl border border-amber-500/50 bg-amber-950/40 p-5 text-amber-100">
            <p className="text-lg font-semibold">
              {view.lookup.employee.name} ({view.lookup.employee.employeeNumber}) hasn&apos;t chosen a gift in this campaign.
            </p>
            <p className="mt-1 text-sm">They can still pick by scanning the poster, or HR can pick on their behalf from the Employees tab.</p>
            <button onClick={reset} className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500">
              OK
            </button>
          </div>
        )}

        {view.mode === "result" && view.lookup.kind === "multiple" && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
            <p className="mb-2 text-sm text-slate-300">Several people match. Pick one:</p>
            <ul className="divide-y divide-slate-700">
              {view.lookup.matches.map((m) => (
                <li key={m.id}>
                  <button onClick={() => pickMatch(m.id)} className="flex w-full items-center justify-between px-2 py-3 text-left hover:bg-slate-700">
                    <span>{m.label}</span>
                    <span className="text-xs text-slate-400">{SELECTION_STATUS_LABEL[m.status] ?? m.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {view.mode === "result" && view.lookup.kind === "selection" && <ResultCard selection={view.lookup.selection} pending={pending} onCollect={collect} onUndo={undo} onCancel={reset} />}
      </section>
    </main>
  );
}

function ResultCard({ selection, pending, onCollect, onUndo, onCancel }: { selection: KioskSelection; pending: boolean; onCollect: (id: string) => void; onUndo: (id: string) => void; onCancel: () => void }) {
  const src = imageSrc(selection, true);
  const collected = selection.status === "COLLECTED";
  const ready = selection.status === "RECEIVED";
  const notIn = selection.status === "SELECTED" || selection.status === "ORDERED";
  const repick = selection.status === "NEEDS_REPICK";
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800">
      <div className="grid gap-4 p-5 sm:grid-cols-[160px_1fr]">
        <ItemThumb src={src} framing={{ thumbFit: selection.thumbFit }} className="rounded-xl" loading="eager" />
        <div>
          <h2 className="text-3xl font-bold">
            {selection.firstName} {selection.lastName}
          </h2>
          <p className="text-slate-300">
            <span className="font-mono">{selection.employeeNumber}</span>
            {selection.department && ` · ${selection.department}`}
          </p>
          <p className="mt-3 text-xl text-white">
            {selection.itemName}
            {selection.optionDetail && (
              <span className="text-slate-300">
                {" "}
                · <strong className="text-white">{selection.optionDetail}</strong>
              </span>
            )}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Code <span className="font-mono text-slate-200">{selection.code}</span> · Status{" "}
            <span className={collected ? "text-emerald-300" : ready ? "text-teal-300" : repick ? "text-amber-300" : "text-slate-200"}>{ready ? "Ready for pickup" : SELECTION_STATUS_LABEL[selection.status] ?? selection.status}</span>
            {collected && selection.collectedAt && ` · ${fmtDate(selection.collectedAt, true)}`}
          </p>
          {notIn && <p className="mt-2 rounded-lg bg-amber-900/50 px-3 py-2 text-sm text-amber-100">⚠️ This gift hasn&apos;t been marked received yet. Only hand it over if it is actually here.</p>}
          {repick && <p className="mt-2 rounded-lg bg-amber-900/50 px-3 py-2 text-sm text-amber-100">This employee&apos;s gift went out of stock. Ask them to choose a new one on their phone.</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-700 bg-slate-900/40 p-4">
        {!collected && !repick && (
          <button
            autoFocus
            disabled={pending}
            onClick={() => onCollect(selection.id)}
            className={`flex-1 rounded-xl px-6 py-4 text-xl font-bold text-white disabled:opacity-50 ${notIn ? "bg-amber-600 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-500"}`}
          >
            {notIn ? "Collect anyway" : "✓ Mark collected"}
          </button>
        )}
        {collected && (
          <button disabled={pending} onClick={() => onUndo(selection.id)} className="rounded-xl border border-slate-600 px-5 py-3 font-semibold text-slate-200 hover:bg-slate-700">
            Undo collection
          </button>
        )}
        <button onClick={onCancel} className="rounded-xl border border-slate-600 px-5 py-3 font-semibold text-slate-200 hover:bg-slate-700">
          {collected || repick ? "Next person" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
