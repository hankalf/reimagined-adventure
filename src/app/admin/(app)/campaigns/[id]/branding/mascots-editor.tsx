"use client";

import { useState } from "react";
import { DancingMascot, MASCOT_KINDS } from "@/components/dancing-mascot";

export const MAX_MASCOTS = 6;

export type MascotValues = {
  id: string | null;
  kind: string;
  imageId: string | null;
  caption: string;
  captionEs: string;
  faceZoom: number;
  faceOffsetX: number;
  faceOffsetY: number;
  faceRotate: number;
  faceFlip: boolean;
  showOnLanding: boolean;
  showOnDone: boolean;
  showOnPoster: boolean;
};

type Card = MascotValues & { key: string; preview: string | null; removePhoto: boolean };

let counter = 0;
const newKey = () => `new${Date.now().toString(36)}${(counter += 1)}`;

function toCard(m: MascotValues): Card {
  return { ...m, key: m.id ?? newKey(), preview: m.imageId ? `/api/images/${m.imageId}?thumb=1` : null, removePhoto: false };
}

/**
 * Edits the campaign's list of mascots inside the Branding form. Every card posts its fields as
 * `mascot:<key>:<field>`; `mascotKeys` lists the cards in order and `mascotDelete` the removed ones.
 */
export function MascotsEditor({ initialEnabled, initialMascots }: { initialEnabled: boolean; initialMascots: MascotValues[] }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [cards, setCards] = useState<Card[]>(() => initialMascots.map(toCard));
  const [deleted, setDeleted] = useState<string[]>([]);

  const update = (key: string, patch: Partial<Card>) => setCards((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  function add() {
    if (cards.length >= MAX_MASCOTS) return;
    const first = cards.length === 0;
    const used = new Set(cards.map((c) => c.kind));
    const kind = MASCOT_KINDS.find((k) => !used.has(k.key))?.key ?? "elf";
    setCards((cs) => [
      ...cs,
      toCard({
        id: null,
        kind,
        imageId: null,
        caption: "",
        captionEs: "",
        faceZoom: 100,
        faceOffsetX: 0,
        faceOffsetY: 0,
        faceRotate: 0,
        faceFlip: false,
        showOnLanding: true,
        showOnDone: first,
        showOnPoster: first,
      }),
    ]);
    setEnabled(true);
  }

  function remove(card: Card) {
    if (card.id) setDeleted((d) => [...d, card.id as string]);
    setCards((cs) => cs.filter((c) => c.key !== card.key));
  }

  function move(index: number, dir: -1 | 1) {
    setCards((cs) => {
      const next = [...cs];
      const j = index + dir;
      if (j < 0 || j >= next.length) return cs;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  return (
    <section className="card p-5" data-mascots-editor>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Holiday mascots 🧝🎅⛄🍌</h2>
          <p className="max-w-3xl text-xs text-slate-500">
            Dancing characters wearing the face of whoever you upload (a plant manager, the CEO…). Add up to {MAX_MASCOTS}, and choose for each one whether it appears on the home page, the
            thank-you page and/or the printed poster. Employees can tap a mascot to make it dance faster. Get each person&apos;s OK first: the home page is reachable by anyone who scans the
            poster.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="mascotEnabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
          Show mascots
        </label>
      </div>

      {cards.map((c) => (
        <input key={`k-${c.key}`} type="hidden" name="mascotKeys" value={c.key} />
      ))}
      {deleted.map((id) => (
        <input key={`d-${id}`} type="hidden" name="mascotDelete" value={id} />
      ))}

      {cards.length === 0 && <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">No mascots yet. Add one to get started.</p>}

      <div className={`mt-4 space-y-4 ${enabled ? "" : "opacity-60"}`}>
        {cards.map((c, index) => {
          const f = (field: string) => `mascot:${c.key}:${field}`;
          const id = (field: string) => `mascot-${c.key}-${field}`;
          const face = { faceSrc: c.removePhoto ? null : c.preview, faceZoom: c.faceZoom, faceOffsetX: c.faceOffsetX, faceOffsetY: c.faceOffsetY, faceRotate: c.faceRotate, faceFlip: c.faceFlip };
          return (
            <div key={c.key} className="rounded-xl border border-slate-200 p-4" data-mascot-card>
              <input type="hidden" name={f("id")} value={c.id ?? ""} />
              <input type="hidden" name={f("removePhoto")} value={c.removePhoto ? "1" : "0"} />
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Mascot {index + 1}: {MASCOT_KINDS.find((k) => k.key === c.kind)?.label ?? c.kind}
                </h3>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="btn-ghost btn-sm" aria-label="Move up">
                    ▲
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === cards.length - 1} className="btn-ghost btn-sm" aria-label="Move down">
                    ▼
                  </button>
                  <button type="button" onClick={() => remove(c)} className="btn-ghost btn-sm text-red-700" data-mascot-remove>
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-[230px_1fr]">
                <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                  <DancingMascot kind={c.kind} {...face} caption={c.caption || undefined} size={180} tapHint="Tap to speed up" />
                  <p className="mt-1 text-center text-[11px] text-slate-500">Live preview. Tap it to see the fast dance.</p>
                </div>
                <div className="space-y-4">
                  <fieldset>
                    <legend className="label">Show on</legend>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name={f("showOnLanding")} checked={c.showOnLanding} onChange={(e) => update(c.key, { showOnLanding: e.target.checked })} className="h-4 w-4" />
                        Home page
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name={f("showOnDone")} checked={c.showOnDone} onChange={(e) => update(c.key, { showOnDone: e.target.checked })} className="h-4 w-4" />
                        Thank-you page
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name={f("showOnPoster")} checked={c.showOnPoster} onChange={(e) => update(c.key, { showOnPoster: e.target.checked })} className="h-4 w-4" />
                        Printed poster
                      </label>
                    </div>
                    {!c.showOnLanding && !c.showOnDone && !c.showOnPoster && <p className="mt-1 text-xs text-amber-700">Not shown anywhere yet; tick at least one place.</p>}
                  </fieldset>

                  <fieldset>
                    <legend className="label">Character</legend>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" data-mascot-picker>
                      {MASCOT_KINDS.map((k) => (
                        <label
                          key={k.key}
                          className={`flex cursor-pointer flex-col items-center rounded-lg border p-1.5 text-center text-[11px] ${c.kind === k.key ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}
                          title={k.label}
                        >
                          <input type="radio" name={f("kind")} value={k.key} checked={c.kind === k.key} onChange={() => update(c.key, { kind: k.key })} className="sr-only" />
                          <DancingMascot kind={k.key} still snow={false} size={52} {...face} />
                          <span className="mt-1 leading-tight">
                            {k.emoji} {k.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <label htmlFor={id("face")} className="label">
                      Face photo
                    </label>
                    <input
                      id={id("face")}
                      name={f("face")}
                      type="file"
                      accept="image/*"
                      className="input"
                      data-mascot-face
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) update(c.key, { preview: URL.createObjectURL(file), removePhoto: false });
                      }}
                    />
                    <p className="mt-1 text-xs text-slate-500">A straight-on headshot works best. Without a photo, a cartoon face is used.</p>
                    {c.preview && !c.removePhoto && (
                      <button type="button" onClick={() => update(c.key, { removePhoto: true, preview: null })} className="mt-1 text-xs text-red-700 hover:underline">
                        Remove photo
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Slider label={`Zoom (${c.faceZoom}%)`} name={f("faceZoom")} min={100} max={250} step={5} value={c.faceZoom} onChange={(v) => update(c.key, { faceZoom: v })} />
                    <Slider label={`Tilt (${c.faceRotate}°)`} name={f("faceRotate")} min={-45} max={45} step={1} value={c.faceRotate} onChange={(v) => update(c.key, { faceRotate: v })} />
                    <Slider label={`Move face left / right (${c.faceOffsetX})`} name={f("faceOffsetX")} min={-40} max={40} step={2} value={c.faceOffsetX} onChange={(v) => update(c.key, { faceOffsetX: v })} />
                    <Slider label={`Move face up / down (${c.faceOffsetY})`} name={f("faceOffsetY")} min={-40} max={40} step={2} value={c.faceOffsetY} onChange={(v) => update(c.key, { faceOffsetY: v })} />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name={f("faceFlip")} checked={c.faceFlip} onChange={(e) => update(c.key, { faceFlip: e.target.checked })} className="h-4 w-4" />
                      Mirror the photo
                    </label>
                    <button type="button" onClick={() => update(c.key, { faceZoom: 100, faceOffsetX: 0, faceOffsetY: 0, faceRotate: 0, faceFlip: false })} className="text-xs text-blue-700 hover:underline">
                      Reset face position
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label htmlFor={id("caption")} className="label">
                        Caption (English)
                      </label>
                      <input id={id("caption")} name={f("caption")} value={c.caption} onChange={(e) => update(c.key, { caption: e.target.value })} className="input" placeholder="Happy holidays from Dave in Plant 2!" />
                    </div>
                    <div>
                      <label htmlFor={id("captionEs")} className="label">
                        Caption (Spanish)
                      </label>
                      <input id={id("captionEs")} name={f("captionEs")} value={c.captionEs} onChange={(e) => update(c.key, { captionEs: e.target.value })} className="input" placeholder="¡Felices fiestas de parte de Dave!" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={add} disabled={cards.length >= MAX_MASCOTS} className="btn-secondary" data-mascot-add>
          + Add {cards.length === 0 ? "a" : "another"} mascot
        </button>
        <span className="text-xs text-slate-500">
          {cards.length} of {MAX_MASCOTS}. The poster shows up to 2 (either side of the QR code); the thank-you page up to 3.
        </span>
      </div>
    </section>
  );
}

function Slider({ label, name, min, max, step, value, onChange }: { label: string; name: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label">
        {label}
        <input name={name} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 block w-full" />
      </label>
    </div>
  );
}
