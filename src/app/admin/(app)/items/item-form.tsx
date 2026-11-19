"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { imageSrc } from "@/lib/image-src";
import { parseOptionValues } from "@/lib/options";
import { ItemThumb } from "@/components/item-thumb";
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
  option1Label: string;
  option1Values: string;
  option2Label: string;
  option2Values: string;
  imageUrl: string;
  imageId: string | null;
  /** Gallery photos; option1Value set = photo for that colour/value. */
  extraImages: Array<{ id: string; imageId: string; option1Value: string | null }>;
  thumbFit: string;
  thumbZoom: number;
  thumbFocusX: number;
  thumbFocusY: number;
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
  const [category, setCategory] = useState(initial.category);
  const [option1Label, setOption1Label] = useState(initial.option1Label);
  const [option1Values, setOption1Values] = useState(initial.option1Values);
  const [option2Label, setOption2Label] = useState(initial.option2Label);
  const [option2Values, setOption2Values] = useState(initial.option2Values);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(imageSrc({ imageId: initial.imageId, imageUrl: null }, false));
  const [removeImage, setRemoveImage] = useState(false);
  const [fetchedImages, setFetchedImages] = useState<string[]>([]);
  const [useFetched, setUseFetched] = useState(true);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [removedExtra, setRemovedExtra] = useState<Set<string>>(new Set());
  const [colorPreviews, setColorPreviews] = useState<Record<string, string>>({});
  const [removedColors, setRemovedColors] = useState<Set<string>>(new Set());
  const [looking, startLookup] = useTransition();
  const [lastLookedUp, setLastLookedUp] = useState("");
  const [thumbFit, setThumbFit] = useState(initial.thumbFit === "cover" ? "cover" : "contain");
  const [thumbZoom, setThumbZoom] = useState(initial.thumbZoom);
  const [thumbFocusX, setThumbFocusX] = useState(initial.thumbFocusX);
  const [thumbFocusY, setThumbFocusY] = useState(initial.thumbFocusY);
  const framing = { thumbFit, thumbZoom, thumbFocusX, thumbFocusY };
  const previewSrc = preview && !removeImage ? preview : imageUrl || null;

  const color1Values = useMemo(() => parseOptionValues(option1Values), [option1Values]);
  const generalExtras = initial.extraImages.filter((i) => !i.option1Value);
  const colorExtras = useMemo(() => Object.fromEntries(initial.extraImages.filter((i) => i.option1Value).map((i) => [i.option1Value as string, i])), [initial.extraImages]);

  function lookup(urlOverride?: string) {
    const url = (urlOverride ?? productUrl).trim();
    if (!url || looking) return;
    setLastLookedUp(url);
    startLookup(async () => {
      const res = await lookupAmazonAction(url);
      setLookupMsg(res.message);
      if (res.ok) {
        if (res.url) setProductUrl(res.url);
        if (res.asin) setAsin(res.asin);
        if (res.title && !name) setName(res.title);
        if (res.description && !description) setDescription(res.description);
        if (res.price && !unitCost) setUnitCost(String(res.price));
        if (res.category && !category) setCategory(res.category);
        if (res.images && res.images.length > 0) {
          setFetchedImages(res.images);
          setUseFetched(true);
        } else if (res.imageUrl && !imageUrl && !preview) setImageUrl(res.imageUrl);
        if (res.variants && res.variants.length > 0 && !option1Values.trim()) {
          const [v1, v2] = res.variants;
          setOption1Label(v1.label);
          setOption1Values(v1.values.join(", "));
          if (v2) {
            setOption2Label(v2.label);
            setOption2Values(v2.values.join(", "));
          }
        }
      }
    });
  }

  /** Auto-fill as soon as a product link is pasted or the field loses focus (once per URL). */
  function maybeAutoLookup(value: string) {
    const url = value.trim();
    if (!/^https?:\/\//i.test(url) || url === lastLookedUp) return;
    if (name.trim() && preview) return; // already filled in; keep the admin's data
    lookup(url);
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
              <input
                id="productUrl"
                name="productUrl"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                onBlur={(e) => maybeAutoLookup(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  setTimeout(() => maybeAutoLookup(pasted), 0);
                }}
                className="input"
                placeholder="Paste the Amazon link; details fill in automatically"
              />
              <button type="button" onClick={() => lookup()} disabled={looking || !productUrl.trim()} className="btn-secondary whitespace-nowrap">
                {looking ? "Looking up…" : "Fetch details"}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {asin ? `ASIN: ${asin}. ` : ""}We read the product page for the name, price, description, category, photos and colour/size options. Amazon sometimes blocks this; then just fill the form in.
            </p>
            {lookupMsg && <p className="mt-2 rounded bg-slate-50 px-3 py-2 text-xs text-slate-700">{lookupMsg}</p>}
            {fetchedImages.length > 0 && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                  <input type="checkbox" name="useFetchedPhotos" checked={useFetched} onChange={(e) => setUseFetched(e.target.checked)} className="h-4 w-4" />
                  Save these {fetchedImages.length} product photo(s) into the gallery when I save
                </label>
                <input type="hidden" name="autoImageUrls" value={JSON.stringify(fetchedImages)} />
                <div className="mt-2 flex flex-wrap gap-2">
                  {fetchedImages.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt="" className="h-16 w-16 rounded border border-emerald-200 bg-white object-contain" />
                  ))}
                </div>
                <p className="mt-1 text-xs text-emerald-800">The first photo becomes the main picture unless you upload one below.</p>
              </div>
            )}
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
            <input id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="input" list="category-list" placeholder="Tech, Home, Apparel…" />
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
        <p className="mb-3 text-xs text-slate-500">
          Up to two groups, e.g. Color and Size. The employee must choose one value per group; the values are included in the order list. When you add the gift to a
          campaign you choose which of these values that campaign offers.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="option1Label" className="label">
              Group 1 label
            </label>
            <input id="option1Label" name="option1Label" value={option1Label} onChange={(e) => setOption1Label(e.target.value)} className="input" placeholder="Color" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="option1Values" className="label">
              Group 1 values (comma separated)
            </label>
            <input id="option1Values" name="option1Values" value={option1Values} onChange={(e) => setOption1Values(e.target.value)} className="input" placeholder="Black, Teal, Rose" />
          </div>
          <div>
            <label htmlFor="option2Label" className="label">
              Group 2 label
            </label>
            <input id="option2Label" name="option2Label" value={option2Label} onChange={(e) => setOption2Label(e.target.value)} className="input" placeholder="Size" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="option2Values" className="label">
              Group 2 values (comma separated)
            </label>
            <input id="option2Values" name="option2Values" value={option2Values} onChange={(e) => setOption2Values(e.target.value)} className="input" placeholder="S, M, L, XL, 2XL" />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 font-semibold">Main photo</h3>
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
            <ItemThumb src={previewSrc} alt="Preview" framing={framing} className="rounded-xl border border-slate-200" loading="eager" />
            <p className="mt-1 text-center text-[11px] text-slate-500">Exactly how the card looks to employees</p>
            {initial.imageId && !removeImage && (
              <button type="button" onClick={() => { setRemoveImage(true); setPreview(null); }} className="mt-1 text-xs text-red-700 hover:underline">
                Remove uploaded photo
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold">Thumbnail framing</h4>
          <p className="mb-3 text-xs text-slate-500">Every gift card is the same square. Choose whether the whole photo fits inside it or fills it, then zoom and move the focal point. The preview on the right updates live.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="thumbFit" value="contain" checked={thumbFit === "contain"} onChange={() => setThumbFit("contain")} />
                Fit whole photo (best for product shots on white)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="thumbFit" value="cover" checked={thumbFit === "cover"} onChange={() => setThumbFit("cover")} />
                Fill the square (crops the edges)
              </label>
            </div>
            <div>
              <label htmlFor="thumbZoom" className="label">
                Zoom ({thumbZoom}%)
              </label>
              <input id="thumbZoom" name="thumbZoom" type="range" min={100} max={250} step={5} value={thumbZoom} onChange={(e) => setThumbZoom(Number(e.target.value))} className="w-full" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="thumbFocusX" className="label">
                  Focus ← → ({thumbFocusX}%)
                </label>
                <input id="thumbFocusX" name="thumbFocusX" type="range" min={0} max={100} step={1} value={thumbFocusX} onChange={(e) => setThumbFocusX(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <label htmlFor="thumbFocusY" className="label">
                  Focus ↑ ↓ ({thumbFocusY}%)
                </label>
                <input id="thumbFocusY" name="thumbFocusY" type="range" min={0} max={100} step={1} value={thumbFocusY} onChange={(e) => setThumbFocusY(Number(e.target.value))} className="w-full" />
              </div>
            </div>
          </div>
          <button type="button" onClick={() => { setThumbFit("contain"); setThumbZoom(100); setThumbFocusX(50); setThumbFocusY(50); }} className="mt-2 text-xs text-blue-700 hover:underline">
            Reset framing
          </button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-1 font-semibold">More photos (gallery)</h3>
        <p className="mb-3 text-xs text-slate-500">Employees can flip through these in the gift details. Upload several at once.</p>
        <div className="flex flex-wrap gap-3">
          {generalExtras.map((img) => {
            const removed = removedExtra.has(img.id);
            return (
              <div key={img.id} className={`relative ${removed ? "opacity-40" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/images/${img.imageId}?thumb=1`} alt="" className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
                <label className="mt-1 flex items-center gap-1 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    name="removeImageIds"
                    value={img.id}
                    checked={removed}
                    onChange={(e) => setRemovedExtra((prev) => { const n = new Set(prev); if (e.target.checked) n.add(img.id); else n.delete(img.id); return n; })}
                    className="h-3 w-3"
                  />
                  Remove
                </label>
              </div>
            );
          })}
          {extraPreviews.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="h-24 w-24 rounded-lg border border-dashed border-emerald-400 object-cover" />
          ))}
        </div>
        <input
          id="extraImages"
          name="extraImages"
          type="file"
          accept="image/*"
          multiple
          className="input mt-3"
          onChange={(e) => setExtraPreviews(Array.from(e.target.files ?? []).map((f) => URL.createObjectURL(f)))}
        />
      </div>

      {color1Values.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-1 font-semibold">Photo per {option1Label || "option"}</h3>
          <p className="mb-3 text-xs text-slate-500">When an employee picks a {(option1Label || "value").toLowerCase()}, the gift photo switches to the one you upload here. Values come from option group 1 above.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {color1Values.map((value) => {
              const existingImg = colorExtras[value];
              const removed = removedColors.has(value);
              const previewSrc = colorPreviews[value] ?? (existingImg && !removed ? `/api/images/${existingImg.imageId}?thumb=1` : null);
              return (
                <div key={value} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-slate-100">
                    {previewSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">none</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{value}</div>
                    <input
                      id={`colorImage-${value.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                      name={`colorImage:${value}`}
                      type="file"
                      accept="image/*"
                      className="mt-1 block w-full text-xs"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setColorPreviews((p) => ({ ...p, [value]: URL.createObjectURL(f) }));
                          setRemovedColors((prev) => { const n = new Set(prev); n.delete(value); return n; });
                        }
                      }}
                    />
                    {existingImg && !removed && !colorPreviews[value] && (
                      <button type="button" onClick={() => setRemovedColors((prev) => new Set(prev).add(value))} className="mt-1 text-[11px] text-red-700 hover:underline">
                        Remove photo
                      </button>
                    )}
                    <input type="hidden" name={`colorImageRemove:${value}`} value={removed ? "1" : "0"} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
