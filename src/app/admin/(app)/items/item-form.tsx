"use client";

import { useActionState, useState, useTransition } from "react";
import { imageSrc } from "@/lib/image-src";
import { deleteItemAction, lookupAmazonAction, saveItemAction, type ItemFormState } from "./actions";

export type ItemFormValues = {
  id?: string;
  type: "PRODUCT" | "CUSTOM";
  name: string;
  nameEs: string;
  description: string;
  descriptionEs: string;
  category: string;
  productUrl: string;
  asin: string;
  sku: string;
  unitCost: string;
  fulfillmentNote: string;
  optionLabel: string;
  optionValues: string;
  imageUrl: string;
  imageId: string | null;
  active: boolean;
  selectionCount?: number;
};

export function ItemForm({ initial, categories }: { initial: ItemFormValues; categories: string[] }) {
  const [state, action, pending] = useActionState<ItemFormState, FormData>(saveItemAction, null);
  const [type, setType] = useState(initial.type);
  const [productUrl, setProductUrl] = useState(initial.productUrl);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [unitCost, setUnitCost] = useState(initial.unitCost);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);
  const [asin, setAsin] = useState(initial.asin);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(imageSrc({ imageId: initial.imageId, imageUrl: null }, false));
  const [removeImage, setRemoveImage] = useState(false);
  const [looking, startLookup] = useTransition();

  function lookup() {
    if (!productUrl.trim()) return;
    startLookup(async () => {
      const res = await lookupAmazonAction(productUrl.trim());
      setLookupMsg(res.message);
      if (res.ok) {
        if (res.url) setProductUrl(res.url);
        if (res.asin) setAsin(res.asin);
        if (res.title && !name) setName(res.title);
        if (res.description && !description) setDescription(res.description);
        if (res.price && !unitCost) setUnitCost(String(res.price));
        if (res.imageUrl && !imageUrl && !preview) setImageUrl(res.imageUrl);
      }
    });
  }

  return (
    <form action={action} className="space-y-6" encType="multipart/form-data">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="removeImage" value={removeImage ? "1" : "0"} />

      <div className="card p-5">
        <div className="mb-4 flex gap-2">
          {(["PRODUCT", "CUSTOM"] as const).map((t) => (
            <label key={t} className={`flex-1 cursor-pointer rounded-lg border p-3 text-sm ${type === t ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>
              <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="mr-2" />
              <span className="font-medium">{t === "PRODUCT" ? "Product (Amazon or other store)" : "Custom gift / perk"}</span>
              <p className="mt-1 text-xs text-slate-500">{t === "PRODUCT" ? "Something HR will buy. Paste the Amazon link to prefill details." : "Something HR arranges internally, like 4 hours of PTO or a lunch with leadership."}</p>
            </label>
          ))}
        </div>

        {type === "PRODUCT" && (
          <div className="mb-4">
            <label htmlFor="productUrl" className="label">
              Amazon / product link
            </label>
            <div className="flex gap-2">
              <input id="productUrl" name="productUrl" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} className="input" placeholder="https://www.amazon.com/dp/B0..." />
              <button type="button" onClick={lookup} disabled={looking || !productUrl.trim()} className="btn-secondary whitespace-nowrap">
                {looking ? "Looking up…" : "Fetch details"}
              </button>
            </div>
            {asin && <p className="mt-1 text-xs text-slate-500">ASIN: {asin}</p>}
            {lookupMsg && <p className="mt-2 rounded bg-slate-50 px-3 py-2 text-xs text-slate-700">{lookupMsg}</p>}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="name" className="label">
              Name (English) *
            </label>
            <input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} className="input" required />
          </div>
          <div>
            <label htmlFor="nameEs" className="label">
              Name (Spanish)
            </label>
            <input id="nameEs" name="nameEs" defaultValue={initial.nameEs} className="input" placeholder="Optional; English is shown if empty" />
          </div>
          <div>
            <label htmlFor="description" className="label">
              Description (English)
            </label>
            <textarea id="description" name="description" value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={4} />
          </div>
          <div>
            <label htmlFor="descriptionEs" className="label">
              Description (Spanish)
            </label>
            <textarea id="descriptionEs" name="descriptionEs" defaultValue={initial.descriptionEs} className="input" rows={4} />
          </div>
          <div>
            <label htmlFor="category" className="label">
              Category
            </label>
            <input id="category" name="category" defaultValue={initial.category} className="input" list="category-list" placeholder="Tech, Home, Apparel…" />
            <datalist id="category-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="unitCost" className="label">
                {type === "PRODUCT" ? "Unit cost" : "Internal cost (optional)"}
              </label>
              <input id="unitCost" name="unitCost" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="input" inputMode="decimal" placeholder="0.00" />
            </div>
            <div>
              <label htmlFor="sku" className="label">
                SKU / reference
              </label>
              <input id="sku" name="sku" defaultValue={initial.sku} className="input" />
            </div>
          </div>
        </div>

        {type === "CUSTOM" && (
          <div className="mt-4">
            <label htmlFor="fulfillmentNote" className="label">
              How HR fulfils this gift
            </label>
            <textarea id="fulfillmentNote" name="fulfillmentNote" defaultValue={initial.fulfillmentNote} className="input" rows={2} placeholder="e.g. Add 4 hours of PTO in the payroll system and notify the manager." />
            <p className="mt-1 text-xs text-slate-500">Shown to HR in the order email and Orders list, never to employees.</p>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="mb-3 font-semibold">Options (optional)</h3>
        <p className="mb-3 text-xs text-slate-500">For sizes or colours. The employee must choose one value, and it is included in the order list.</p>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="optionLabel" className="label">
              Option label
            </label>
            <input id="optionLabel" name="optionLabel" defaultValue={initial.optionLabel} className="input" placeholder="Size" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="optionValues" className="label">
              Values (comma separated)
            </label>
            <input id="optionValues" name="optionValues" defaultValue={initial.optionValues} className="input" placeholder="S, M, L, XL, 2XL" />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 font-semibold">Photo</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 space-y-3">
            <div>
              <label htmlFor="image" className="label">
                Upload a photo
              </label>
              <input
                id="image"
                name="image"
                type="file"
                accept="image/*"
                className="input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setPreview(URL.createObjectURL(f));
                    setRemoveImage(false);
                  }
                }}
              />
              <p className="mt-1 text-xs text-slate-500">JPG, PNG or WebP up to 8 MB. We resize it and create a thumbnail automatically. Tip: right-click the product photo on Amazon and save it, then upload here.</p>
            </div>
            <div>
              <label htmlFor="imageUrl" className="label">
                …or paste an image URL
              </label>
              <input id="imageUrl" name="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="input" placeholder="https://" />
              <p className="mt-1 text-xs text-slate-500">Used when no photo is uploaded. External links can break if the store changes them.</p>
            </div>
          </div>
          <div>
            <div className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {preview && !removeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Preview" className="h-full w-full object-cover" />
              ) : imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl text-slate-300">🎁</div>
              )}
            </div>
            {initial.imageId && !removeImage && (
              <button type="button" onClick={() => { setRemoveImage(true); setPreview(null); }} className="mt-2 text-xs text-red-700 hover:underline">
                Remove uploaded photo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={initial.active} className="h-4 w-4" />
          Active (inactive gifts are hidden from employees everywhere)
        </label>
        <div className="flex items-center gap-2">
          {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Saving…" : initial.id ? "Save changes" : "Create gift"}
          </button>
        </div>
      </div>

      {initial.id && (
        <div className="card border-red-200 p-5">
          <h3 className="font-semibold text-red-800">Danger zone</h3>
          <p className="mt-1 text-sm text-slate-600">
            {initial.selectionCount ? `${initial.selectionCount} employee(s) have chosen this gift, so deleting will deactivate it instead of removing it.` : "This gift has never been chosen, so it can be removed completely."}
          </p>
          <button
            type="submit"
            formAction={deleteItemAction}
            formNoValidate
            className="btn-danger mt-3"
            onClick={(e) => {
              if (!window.confirm("Delete this gift from the catalog?")) e.preventDefault();
            }}
          >
            {initial.selectionCount ? "Deactivate gift" : "Delete gift"}
          </button>
        </div>
      )}
    </form>
  );
}
