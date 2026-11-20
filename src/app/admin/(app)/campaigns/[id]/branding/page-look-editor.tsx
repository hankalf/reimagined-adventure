"use client";

import { useState } from "react";
import { BG_PATTERNS, FONT_STYLES, QUICK_THEMES, fontStack, pageBackgroundStyle, resolvedTextMode } from "@/lib/theme";

export type PageLookValues = {
  bgPattern: string;
  bgColor: string;
  bgColor2: string;
  bgImageId: string | null;
  bgOverlay: number;
  textMode: string;
  fontStyle: string;
  cardStyle: string;
};

type Props = {
  initial: PageLookValues;
  primary: string;
  accent: string;
  setPrimary: (v: string) => void;
  setAccent: (v: string) => void;
  headline: string;
};

function ColorField({ id, name, label, value, onChange }: { id: string; name: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 rounded border border-slate-300" aria-label={`Pick ${label.toLowerCase()}`} />
        <input id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)} className="input font-mono" />
      </div>
    </div>
  );
}

/** "Page look" section of the Branding form: quick themes, background, text contrast, font, cards. */
export function PageLookEditor({ initial, primary, accent, setPrimary, setAccent, headline }: Props) {
  const [bgPattern, setBgPattern] = useState(initial.bgPattern);
  const [bgColor, setBgColor] = useState(initial.bgColor);
  const [bgColor2, setBgColor2] = useState(initial.bgColor2);
  const [bgPreview, setBgPreview] = useState<string | null>(initial.bgImageId ? `/api/images/${initial.bgImageId}` : null);
  const [removeBg, setRemoveBg] = useState(false);
  const [bgOverlay, setBgOverlay] = useState(initial.bgOverlay);
  const [textMode, setTextMode] = useState(initial.textMode);
  const [fontStyle, setFontStyle] = useState(initial.fontStyle);
  const [cardStyle, setCardStyle] = useState(initial.cardStyle);

  const imageUrl = removeBg ? null : bgPreview;
  const theme = { bgPattern, bgColor, bgColor2, bgImageUrl: imageUrl, bgOverlay, textMode, fontStyle, cardStyle, accentColor: accent };
  const light = resolvedTextMode(theme) === "light";

  function applyQuickTheme(q: (typeof QUICK_THEMES)[number]) {
    setPrimary(q.primaryColor);
    setAccent(q.accentColor);
    setBgPattern(q.bgPattern);
    setBgColor(q.bgColor);
    setBgColor2(q.bgColor2);
    setFontStyle(q.fontStyle);
    setTextMode(q.textMode);
    setCardStyle(q.cardStyle);
  }

  return (
    <section className="card p-5" data-page-look>
      <input type="hidden" name="bgRemove" value={removeBg ? "1" : "0"} />
      <h2 className="font-semibold">Page look (employee pages)</h2>
      <p className="text-xs text-slate-500">Background, colours and font for the home page, gift grid and thank-you page. Gift cards and forms stay white so they are always easy to read.</p>

      <div className="mt-4">
        <div className="label">Quick themes</div>
        <div className="flex flex-wrap gap-2" data-quick-themes>
          {QUICK_THEMES.map((q) => (
            <button
              key={q.key}
              type="button"
              onClick={() => applyQuickTheme(q)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium hover:border-slate-400"
              data-quick-theme={q.key}
            >
              <span
                className="h-6 w-10 rounded border border-slate-200"
                style={pageBackgroundStyle({ bgPattern: q.bgPattern, bgColor: q.bgColor, bgColor2: q.bgColor2, bgImageUrl: null, bgOverlay: 0, accentColor: q.accentColor })}
              />
              <span className="h-3 w-3 rounded-full" style={{ background: q.primaryColor }} />
              {q.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">A quick theme fills in everything below (and the primary/accent colours above); adjust anything afterwards.</p>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <fieldset>
            <legend className="label">Background</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-bg-patterns>
              {BG_PATTERNS.map((p) => (
                <label key={p.key} className={`cursor-pointer rounded-lg border p-1.5 text-center text-[11px] ${bgPattern === p.key && !imageUrl ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <input type="radio" name="bgPattern" value={p.key} checked={bgPattern === p.key} onChange={() => setBgPattern(p.key)} className="sr-only" />
                  <span className="block h-12 rounded" style={pageBackgroundStyle({ bgPattern: p.key, bgColor, bgColor2, bgImageUrl: null, bgOverlay: 0, accentColor: accent })} />
                  <span className="mt-1 block leading-tight">{p.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField id="bgColor" name="bgColor" label="Background colour" value={bgColor} onChange={setBgColor} />
            <ColorField id="bgColor2" name="bgColor2" label="Second colour (gradient / pattern)" value={bgColor2} onChange={setBgColor2} />
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <label htmlFor="bg" className="label">
              Or upload a background photo
            </label>
            <input
              id="bg"
              name="bg"
              type="file"
              accept="image/*"
              className="input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setBgPreview(URL.createObjectURL(f));
                  setRemoveBg(false);
                }
              }}
            />
            <p className="mt-1 text-xs text-slate-500">A wide photo works best (e.g. the plant decorated, a winter scene). It replaces the pattern and is darkened so text stays readable.</p>
            {imageUrl && (
              <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label htmlFor="bgOverlay" className="label">
                    Darken photo ({bgOverlay}%)
                  </label>
                  <input id="bgOverlay" name="bgOverlay" type="range" min={0} max={80} step={5} value={bgOverlay} onChange={(e) => setBgOverlay(Number(e.target.value))} className="w-full" />
                </div>
                <button type="button" onClick={() => setRemoveBg(true)} className="text-xs text-red-700 hover:underline">
                  Remove photo
                </button>
              </div>
            )}
            {!imageUrl && <input type="hidden" name="bgOverlay" value={bgOverlay} />}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="fontStyle" className="label">
                Font
              </label>
              <select id="fontStyle" name="fontStyle" value={fontStyle} onChange={(e) => setFontStyle(e.target.value)} className="input">
                {FONT_STYLES.map((f) => (
                  <option key={f.key} value={f.key} style={{ fontFamily: f.stack }}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="textMode" className="label">
                Text on the background
              </label>
              <select id="textMode" name="textMode" value={textMode} onChange={(e) => setTextMode(e.target.value)} className="input">
                <option value="auto">Automatic ({light ? "light" : "dark"})</option>
                <option value="dark">Dark text</option>
                <option value="light">Light text</option>
              </select>
            </div>
            <div>
              <label htmlFor="cardStyle" className="label">
                Cards
              </label>
              <select id="cardStyle" name="cardStyle" value={cardStyle} onChange={(e) => setCardStyle(e.target.value)} className="input">
                <option value="solid">Solid white</option>
                <option value="glass">Frosted glass</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <div className="label">Live preview</div>
          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm" data-page-look-preview data-text={light ? "light" : "dark"} data-card-style={cardStyle} style={{ ...pageBackgroundStyle(theme), fontFamily: fontStack(fontStyle) }}>
            <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-white" style={{ background: primary }}>
                🎁
              </span>
              Your company
            </div>
            <div className="space-y-3 p-4">
              <p className="theme-text text-lg font-bold leading-tight" style={{ color: primary }}>
                {headline || "Choose your gift"}
              </p>
              <p className="theme-muted text-xs text-slate-700">Thank you for an amazing year. Pick one gift below.</p>
              <div className="card space-y-2 p-3">
                <div className="text-[11px] font-semibold text-slate-800">Employee number</div>
                <div className="h-6 rounded border border-slate-300 bg-white" />
                <div className="rounded py-1.5 text-center text-xs font-semibold text-white" style={{ background: primary }}>
                  Continue
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-lg border border-slate-200 bg-white p-1">
                    <div className="aspect-square rounded" style={{ background: i === 1 ? accent : `${primary}33` }} />
                    <div className="mt-1 h-1.5 w-3/4 rounded bg-slate-300" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
