"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { fill, formatMoney, localized, type Lang } from "@/i18n";
import type { Dictionary } from "@/i18n/en";
import { imageSrc } from "@/lib/image-src";
import type { PickItem } from "@/lib/selection";
import { chooseAction, type ChooseState } from "../actions";

type Props = {
  slug: string;
  lang: Lang;
  t: Dictionary;
  items: PickItem[];
  currency: string;
  currentItemId: string | null;
  allowChange: boolean;
};

export function GiftGrid({ slug, lang, t, items, currency, currentItemId, allowChange }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [open, setOpen] = useState<PickItem | null>(null);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c)))].sort(), [items]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (category && i.category !== category) return false;
      if (!q) return true;
      const name = `${i.name} ${i.nameEs ?? ""} ${i.description} ${i.descriptionEs ?? ""} ${i.category ?? ""}`.toLowerCase();
      return name.includes(q);
    });
  }, [items, query, category]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.pick.search}
          className="input sm:max-w-xs"
          aria-label={t.pick.search}
        />
        {categories.length > 1 && (
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input sm:max-w-xs" aria-label={t.pick.allCategories}>
            <option value="">{t.pick.allCategories}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-slate-500">{t.pick.noResults}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => {
            const src = imageSrc(item, true);
            const disabled = !item.available || item.overBudget;
            const name = localized(lang, item.name, item.nameEs);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpen(item)}
                  className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                    currentItemId === item.id ? "border-brand ring-2 ring-brand/30" : "border-slate-200"
                  } ${disabled ? "opacity-70" : ""}`}
                  aria-label={`${t.pick.viewDetails}: ${name}`}
                >
                  <div className="relative aspect-square w-full bg-slate-100">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={name} loading="lazy" className={`h-full w-full object-cover ${disabled ? "grayscale" : ""}`} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-5xl">🎁</div>
                    )}
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
      )}

      {open && (
        <ItemDialog
          item={open}
          slug={slug}
          lang={lang}
          t={t}
          currency={currency}
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
  currency,
  allowChange,
  onClose,
}: {
  item: PickItem;
  slug: string;
  lang: Lang;
  t: Dictionary;
  currency: string;
  allowChange: boolean;
  onClose: () => void;
}) {
  const [choices, setChoices] = useState<Record<number, string>>(() => Object.fromEntries(item.groups.map((g) => [g.index, g.values.length === 1 ? g.values[0] : ""])));
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<ChooseState, FormData>(chooseAction, null);
  const name = localized(lang, item.name, item.nameEs);
  const description = localized(lang, item.description, item.descriptionEs);
  const src = imageSrc(item, false);
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
          <div className="relative aspect-square bg-slate-100 sm:rounded-l-2xl">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={name} className="h-full w-full object-cover sm:rounded-l-2xl" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-7xl">🎁</div>
            )}
            <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-sm font-medium shadow sm:hidden" aria-label={t.pick.close}>
              ✕
            </button>
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
            {item.productUrl && item.type === "PRODUCT" && (
              <a href={item.productUrl} target="_blank" rel="noopener noreferrer" className="mt-3 text-sm font-medium text-brand underline-offset-2 hover:underline">
                {t.pick.viewProduct} ↗
              </a>
            )}

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
                            onChange={() => setChoices((c) => ({ ...c, [g.index]: v }))}
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
              {item.cost !== null && item.cost > 0 && item.type === "PRODUCT" && (
                <p className="mt-3 text-center text-xs text-slate-400">{formatMoney(item.cost, currency, lang)}</p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
