"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { fill, localized, type Lang } from "@/i18n";
import type { Dictionary } from "@/i18n/en";
import { imageSrc } from "@/lib/image-src";
import { ItemThumb } from "@/components/item-thumb";
import type { PickItem } from "@/lib/selection";
import { chooseAction, type ChooseState } from "../actions";

type Props = {
  slug: string;
  lang: Lang;
  t: Dictionary;
  items: PickItem[];
  currentItemId: string | null;
  allowChange: boolean;
};

const SHORTLIST_MAX = 5;

export function GiftGrid({ slug, lang, t, items, currentItemId, allowChange }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [open, setOpen] = useState<PickItem | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [onlyShortlist, setOnlyShortlist] = useState(false);
  const storageKey = `gp_shortlist_${slug}`;

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
        if (Array.isArray(saved)) setShortlist(saved.filter((id: unknown): id is string => typeof id === "string" && items.some((i) => i.id === id)));
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [storageKey, items]);

  function toggleShortlist(id: string) {
    setShortlist((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-SHORTLIST_MAX);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      if (next.length === 0) setOnlyShortlist(false);
      return next;
    });
  }

  function surpriseMe() {
    const pool = items.filter((i) => i.available && !i.overBudget);
    if (pool.length === 0) return;
    setOpen(pool[Math.floor(Math.random() * pool.length)]);
  }

  // Categories in the order they first appear (admins control item order); uncategorised gifts go last.
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const i of items) if (i.category && !seen.includes(i.category)) seen.push(i.category);
    return seen;
  }, [items]);
  const hasUncategorized = items.some((i) => !i.category);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (onlyShortlist && !shortlist.includes(i.id)) return false;
      if (category && (i.category ?? "__none__") !== category) return false;
      if (!q) return true;
      const name = `${i.name} ${i.nameEs ?? ""} ${i.description} ${i.descriptionEs ?? ""} ${i.category ?? ""}`.toLowerCase();
      return name.includes(q);
    });
  }, [items, query, category, onlyShortlist, shortlist]);
  // "All gifts" view groups the list under category headings.
  const sections = useMemo(() => {
    if (category || categories.length === 0) return [{ key: category || "all", title: null as string | null, items: visible }];
    const out: Array<{ key: string; title: string | null; items: PickItem[] }> = [];
    for (const c of categories) {
      const list = visible.filter((i) => i.category === c);
      if (list.length > 0) out.push({ key: c, title: c, items: list });
    }
    const rest = visible.filter((i) => !i.category);
    if (rest.length > 0) out.push({ key: "__none__", title: t.pick.uncategorized, items: rest });
    return out;
  }, [category, categories, visible, t.pick.uncategorized]);

  const pill = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition ${active ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`;

  return (
    <div>
      {categories.length > 0 && (
        <div className="-mx-4 mb-4 overflow-x-auto px-4" role="tablist" aria-label={t.pick.allCategories}>
          <div className="flex gap-2">
            <button type="button" role="tab" aria-selected={category === ""} onClick={() => setCategory("")} className={pill(category === "")}>
              {t.pick.allCategories}
            </button>
            {categories.map((c) => (
              <button key={c} type="button" role="tab" aria-selected={category === c} onClick={() => setCategory(c)} className={pill(category === c)}>
                {c}
              </button>
            ))}
            {hasUncategorized && (
              <button type="button" role="tab" aria-selected={category === "__none__"} onClick={() => setCategory("__none__")} className={pill(category === "__none__")}>
                {t.pick.uncategorized}
              </button>
            )}
          </div>
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.pick.search}
          className="input sm:max-w-xs"
          aria-label={t.pick.search}
        />
        <button type="button" onClick={surpriseMe} className="btn-secondary whitespace-nowrap" data-surprise>
          🎲 {t.pick.surpriseMe}
        </button>
        {shortlist.length > 0 && (
          <button type="button" onClick={() => setOnlyShortlist((v) => !v)} className={`whitespace-nowrap ${onlyShortlist ? "btn-primary" : "btn-secondary"}`} data-shortlist-toggle aria-pressed={onlyShortlist}>
            ♥ {onlyShortlist ? t.pick.shortlistAll : fill(t.pick.shortlistOnly, { n: shortlist.length })}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-slate-500">{t.pick.noResults}</p>
      ) : (
        sections.map((section) => (
        <section key={section.key} className="mb-8">
          {section.title && <h2 className="mb-3 text-lg font-semibold text-slate-900">{section.title}</h2>}
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {section.items.map((item) => {
            const src = imageSrc(item, true);
            const disabled = !item.available || item.overBudget;
            const name = localized(lang, item.name, item.nameEs);
            const hearted = shortlist.includes(item.id);
            return (
              <li key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => toggleShortlist(item.id)}
                  aria-pressed={hearted}
                  aria-label={hearted ? t.pick.shortlistRemove : t.pick.shortlistAdd}
                  title={hearted ? t.pick.shortlistRemove : t.pick.shortlistAdd}
                  data-heart
                  className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow ${hearted ? "bg-rose-500 text-white" : "bg-white/90 text-slate-500 hover:text-rose-500"}`}
                >
                  {hearted ? "♥" : "♡"}
                </button>
                <button
                  type="button"
                  data-card
                  onClick={() => setOpen(item)}
                  className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                    currentItemId === item.id ? "border-brand ring-2 ring-brand/30" : "border-slate-200"
                  } ${disabled ? "opacity-70" : ""}`}
                  aria-label={`${t.pick.viewDetails}: ${name}`}
                >
                  <div className="relative w-full">
                    <ItemThumb src={src} alt={name} framing={item.framing} imgClassName={disabled ? "grayscale" : ""} />
                    <div className="absolute left-2 top-2 flex flex-col gap-1">
                      {item.type === "CUSTOM" && <span className="badge bg-emerald-600 text-white">{t.pick.perk}</span>}
                      {item.soldOut && <span className="badge bg-slate-800 text-white">{t.pick.soldOut}</span>}
                      {!item.soldOut && item.remaining !== null && item.remaining <= 5 && (
                        <span className="badge bg-amber-500 text-white">{fill(t.pick.onlyLeft, { n: item.remaining })}</span>
                      )}
                      {item.overBudget && <span className="badge bg-red-600 text-white">{t.pick.overBudget}</span>}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-brand">{name}</h3>
                    {item.category && <p className="mt-1 text-xs text-slate-500">{item.category}</p>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        </section>
        ))
      )}

      {open && (
        <ItemDialog
          item={open}
          slug={slug}
          lang={lang}
          t={t}
          allowChange={allowChange}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function ItemDialog({
  item,
  slug,
  lang,
  t,
  allowChange,
  onClose,
}: {
  item: PickItem;
  slug: string;
  lang: Lang;
  t: Dictionary;
  allowChange: boolean;
  onClose: () => void;
}) {
  const [choices, setChoices] = useState<Record<number, string>>(() => Object.fromEntries(item.groups.map((g) => [g.index, g.values.length === 1 ? g.values[0] : ""])));
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<ChooseState, FormData>(chooseAction, null);
  const name = localized(lang, item.name, item.nameEs);
  const description = localized(lang, item.description, item.descriptionEs);
  // Gallery: main photo first, then general extras, then per-colour photos.
  const photos = useMemo(() => {
    const list: Array<{ src: string; thumb: string; option1Value: string | null }> = [];
    if (item.imageId) list.push({ src: `/api/images/${item.imageId}`, thumb: `/api/images/${item.imageId}?thumb=1`, option1Value: null });
    else if (item.imageUrl) list.push({ src: item.imageUrl, thumb: item.imageUrl, option1Value: null });
    for (const g of item.gallery) list.push({ src: `/api/images/${g.imageId}`, thumb: `/api/images/${g.imageId}?thumb=1`, option1Value: g.option1Value });
    return list;
  }, [item]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const colourPhotoIndex = choices[1] ? photos.findIndex((p) => p.option1Value === choices[1]) : -1;
  const activeIndex = Math.min(photos.length - 1, Math.max(0, photoIndex));
  const src = photos[activeIndex]?.src ?? null;
  const allChosen = item.groups.every((g) => Boolean(choices[g.index]));
  const chosenText = item.groups.map((g) => choices[g.index]).filter(Boolean).join(" / ");
  const canChoose = item.available && !item.overBudget;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-6" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-dialog-title"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid sm:grid-cols-2">
          <div className="flex flex-col bg-slate-100 sm:rounded-l-2xl">
            <div className="relative aspect-square">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={name} data-gallery-main data-option={photos[activeIndex]?.option1Value ?? ""} className={`h-full w-full bg-white sm:rounded-tl-2xl ${item.framing.thumbFit === "cover" ? "object-cover" : "object-contain"}`} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-7xl">🎁</div>
              )}
              {photos.length > 1 && (
                <>
                  <button type="button" onClick={() => setPhotoIndex((activeIndex - 1 + photos.length) % photos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-1 text-lg shadow" aria-label="Previous photo">
                    ‹
                  </button>
                  <button type="button" onClick={() => setPhotoIndex((activeIndex + 1) % photos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-1 text-lg shadow" aria-label="Next photo">
                    ›
                  </button>
                </>
              )}
              {colourPhotoIndex >= 0 && activeIndex === colourPhotoIndex && choices[1] && (
                <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{choices[1]}</span>
              )}
              <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-sm font-medium shadow sm:hidden" aria-label={t.pick.close}>
                ✕
              </button>
            </div>
            {photos.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto p-2">
                {photos.map((p, i) => (
                  <button
                    key={`${p.src}-${i}`}
                    type="button"
                    data-gallery-thumb
                    onClick={() => setPhotoIndex(i)}
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 ${i === activeIndex ? "border-brand" : "border-transparent"}`}
                    aria-label={p.option1Value ? `${p.option1Value}` : `Photo ${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                    {p.option1Value && <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 text-[9px] text-white">{p.option1Value}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 id="item-dialog-title" className="text-xl font-bold text-slate-900">
                {name}
              </h2>
              <button type="button" onClick={onClose} className="hidden rounded-full p-1 text-slate-500 hover:bg-slate-100 sm:block" aria-label={t.pick.close}>
                ✕
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              {item.category && <span className="badge bg-slate-100 text-slate-700">{item.category}</span>}
              {item.type === "CUSTOM" && <span className="badge bg-emerald-100 text-emerald-800">{t.pick.perk}</span>}
              {item.soldOut && <span className="badge bg-slate-800 text-white">{t.pick.soldOut}</span>}
              {item.overBudget && <span className="badge bg-red-100 text-red-800">{t.pick.overBudget}</span>}
            </div>
            {description && <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{description}</p>}
            {item.type === "CUSTOM" && <p className="mt-3 text-xs text-slate-500">{t.pick.customGiftNote}</p>}

            <form action={action} className="mt-auto pt-5">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="itemId" value={item.id} />
              {item.groups.map((g) => (
                <fieldset key={g.index} className="mb-4">
                  <legend className="label">{fill(t.pick.chooseOption, { label: g.label })}</legend>
                  <div className="flex flex-wrap gap-2">
                    {g.values.map((v) => {
                      const selected = choices[g.index] === v;
                      return (
                        <label
                          key={v}
                          className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                            selected ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`option${g.index}Value`}
                            value={v}
                            checked={selected}
                            onChange={() => {
                              setChoices((c) => ({ ...c, [g.index]: v }));
                              if (g.index === 1) {
                                const idx = photos.findIndex((p) => p.option1Value === v);
                                if (idx >= 0) setPhotoIndex(idx);
                              }
                            }}
                            className="sr-only"
                            required
                          />
                          {v}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
              {state?.error && (
                <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {state.error}
                </div>
              )}

              {!confirming ? (
                <button
                  type="button"
                  disabled={!canChoose || !allChosen}
                  onClick={() => setConfirming(true)}
                  className="btn w-full bg-brand py-3 text-base text-white hover:opacity-90 focus:ring-blue-300"
                >
                  {t.pick.selectThis}
                </button>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-slate-900">{t.pick.confirmTitle}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {fill(allowChange ? t.pick.confirmBody : t.pick.confirmBodyLocked, { item: chosenText ? `${name} (${chosenText})` : name })}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button type="submit" disabled={pending} className="btn flex-1 bg-brand text-white hover:opacity-90 focus:ring-blue-300">
                      {pending ? "…" : t.pick.confirm}
                    </button>
                    <button type="button" onClick={() => setConfirming(false)} className="btn-secondary flex-1" disabled={pending}>
                      {t.pick.cancel}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
