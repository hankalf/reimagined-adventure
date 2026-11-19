"use client";

import { useActionState, useState } from "react";
import { DancingMascot, MASCOT_KINDS } from "@/components/dancing-mascot";
import { updateBrandingAction, type FormState } from "../../actions";

type Branding = {
  id: string;
  slug: string;
  companyName: string;
  primaryColor: string;
  accentColor: string;
  logoImageId: string | null;
  heroImageId: string | null;
  welcomeHeadline: string;
  welcomeHeadlineEs: string;
  welcomeMessage: string;
  welcomeMessageEs: string;
  pickupInstructions: string;
  pickupInstructionsEs: string;
  leadershipMessage: string;
  leadershipMessageEs: string;
  leadershipName: string;
  mascotEnabled: boolean;
  mascotImageId: string | null;
  mascotCaption: string;
  mascotCaptionEs: string;
  mascotShowOnDone: boolean;
  mascotKind: string;
  mascotFaceZoom: number;
  mascotFaceOffsetX: number;
  mascotFaceOffsetY: number;
  mascotFaceRotate: number;
  mascotFaceFlip: boolean;
  videoUrl: string;
  showPickCount: boolean;
  notifyEmployeesOnReceived: boolean;
};

function Bilingual({ name, label, value, valueEs, rows }: { name: string; label: string; value: string; valueEs: string; rows?: number }) {
  const Field = rows ? "textarea" : "input";
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <label htmlFor={name} className="label">
          {label} (English)
        </label>
        <Field id={name} name={name} defaultValue={value} className="input" rows={rows} />
      </div>
      <div>
        <label htmlFor={`${name}Es`} className="label">
          {label} (Spanish)
        </label>
        <Field id={`${name}Es`} name={`${name}Es`} defaultValue={valueEs} className="input" rows={rows} placeholder="Optional; English shown if empty" />
      </div>
    </div>
  );
}

export function BrandingForm({ campaign }: { campaign: Branding }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateBrandingAction, null);
  const [primary, setPrimary] = useState(campaign.primaryColor);
  const [accent, setAccent] = useState(campaign.accentColor);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeHero, setRemoveHero] = useState(false);
  const [mascotEnabled, setMascotEnabled] = useState(campaign.mascotEnabled);
  const [removeMascot, setRemoveMascot] = useState(false);
  const [mascotPreview, setMascotPreview] = useState<string | null>(campaign.mascotImageId ? `/api/images/${campaign.mascotImageId}?thumb=1` : null);
  const [mascotKind, setMascotKind] = useState(campaign.mascotKind);
  const [mascotZoom, setMascotZoom] = useState(campaign.mascotFaceZoom);
  const [mascotOffsetX, setMascotOffsetX] = useState(campaign.mascotFaceOffsetX);
  const [mascotOffset, setMascotOffset] = useState(campaign.mascotFaceOffsetY);
  const [mascotRotate, setMascotRotate] = useState(campaign.mascotFaceRotate);
  const [mascotFlip, setMascotFlip] = useState(campaign.mascotFaceFlip);
  const [mascotCaption, setMascotCaption] = useState(campaign.mascotCaption);

  return (
    <form action={action} className="space-y-6" encType="multipart/form-data">
      <input type="hidden" name="id" value={campaign.id} />
      <input type="hidden" name="logoRemove" value={removeLogo ? "1" : "0"} />
      <input type="hidden" name="heroRemove" value={removeHero ? "1" : "0"} />
      <input type="hidden" name="mascotRemove" value={removeMascot ? "1" : "0"} />

      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Look and feel</h2>
            <p className="text-xs text-slate-500">Shown on every employee page for this campaign.</p>
          </div>
          <a href={`/g/${campaign.slug}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
            Preview employee page ↗
          </a>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="companyName" className="label">
              Company name
            </label>
            <input id="companyName" name="companyName" defaultValue={campaign.companyName} className="input" />
          </div>
          <div>
            <label htmlFor="primaryColor" className="label">
              Primary colour
            </label>
            <div className="flex gap-2">
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-12 rounded border border-slate-300" aria-label="Pick primary colour" />
              <input id="primaryColor" name="primaryColor" value={primary} onChange={(e) => setPrimary(e.target.value)} className="input font-mono" />
            </div>
          </div>
          <div>
            <label htmlFor="accentColor" className="label">
              Accent colour
            </label>
            <div className="flex gap-2">
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-12 rounded border border-slate-300" aria-label="Pick accent colour" />
              <input id="accentColor" name="accentColor" value={accent} onChange={(e) => setAccent(e.target.value)} className="input font-mono" />
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="logo" className="label">
              Logo (shown in the header)
            </label>
            {campaign.logoImageId && !removeLogo && (
              <div className="mb-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/images/${campaign.logoImageId}`} alt="Current logo" className="h-12 rounded border border-slate-200 bg-white p-1" />
                <button type="button" onClick={() => setRemoveLogo(true)} className="text-xs text-red-700 hover:underline">
                  Remove
                </button>
              </div>
            )}
            <input id="logo" name="logo" type="file" accept="image/*" className="input" />
          </div>
          <div>
            <label htmlFor="hero" className="label">
              Hero image (top of the landing page)
            </label>
            {campaign.heroImageId && !removeHero && (
              <div className="mb-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/images/${campaign.heroImageId}?thumb=1`} alt="Current hero" className="h-12 rounded border border-slate-200 object-cover" />
                <button type="button" onClick={() => setRemoveHero(true)} className="text-xs text-red-700 hover:underline">
                  Remove
                </button>
              </div>
            )}
            <input id="hero" name="hero" type="file" accept="image/*" className="input" />
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 p-4" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
          <p className="text-sm font-semibold text-white">Preview of your colours</p>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Text employees see</h2>
        <Bilingual name="welcomeHeadline" label="Headline" value={campaign.welcomeHeadline} valueEs={campaign.welcomeHeadlineEs} />
        <Bilingual name="welcomeMessage" label="Welcome message" value={campaign.welcomeMessage} valueEs={campaign.welcomeMessageEs} rows={3} />
        <Bilingual name="pickupInstructions" label="Pickup instructions (shown after choosing)" value={campaign.pickupInstructions} valueEs={campaign.pickupInstructionsEs} rows={3} />
        <Bilingual name="leadershipMessage" label="Message from leadership (optional)" value={campaign.leadershipMessage} valueEs={campaign.leadershipMessageEs} rows={3} />
        <div className="md:w-1/2">
          <label htmlFor="leadershipName" className="label">
            Signed by
          </label>
          <input id="leadershipName" name="leadershipName" defaultValue={campaign.leadershipName} className="input" placeholder="Dana Reyes, CEO" />
        </div>
        <div>
          <label htmlFor="videoUrl" className="label">
            Thank-you video (YouTube, Vimeo or a direct .mp4 link)
          </label>
          <input id="videoUrl" name="videoUrl" defaultValue={campaign.videoUrl} className="input" placeholder="https://www.youtube.com/watch?v=…" />
          <p className="mt-1 text-xs text-slate-500">Embedded on the landing page under the welcome message. Leave empty for none.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showPickCount" defaultChecked={campaign.showPickCount} className="h-4 w-4" />
          Show “N of your colleagues have already chosen” on the landing page (once at least 3 have picked)
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="notifyEmployeesOnReceived" defaultChecked={campaign.notifyEmployeesOnReceived} className="mt-0.5 h-4 w-4" />
          <span>
            Email employees when their gift is marked received
            <span className="block text-xs text-slate-500">Needs an email column in the employee list and SMTP configured on Railway. Silently skipped otherwise.</span>
          </span>
        </label>
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Holiday mascot 🧝🎅⛄🍌</h2>
            <p className="text-xs text-slate-500">
              A dancing character on the employee landing page wearing the face of whoever you upload (a plant manager, the CEO…). Pick an elf, Santa, a snowman, a reindeer, a gingerbread
              person or dancing fruit. Employees can tap it to make it dance faster. Get the person&apos;s OK first: the landing page is reachable by anyone who scans the poster.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="mascotEnabled" checked={mascotEnabled} onChange={(e) => setMascotEnabled(e.target.checked)} className="h-4 w-4" />
            Show the elf
          </label>
        </div>
        <div className="mt-4 grid gap-5 md:grid-cols-[260px_1fr]">
          <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
            <DancingMascot kind={mascotKind} faceSrc={removeMascot ? null : mascotPreview} faceZoom={mascotZoom} faceOffsetX={mascotOffsetX} faceOffsetY={mascotOffset} faceRotate={mascotRotate} faceFlip={mascotFlip} caption={mascotCaption || undefined} size={200} tapHint="Tap to speed up" />
            <p className="mt-1 text-center text-[11px] text-slate-500">Live preview. Tap the elf to see the fast dance.</p>
          </div>
          <div className="space-y-4">
            <fieldset>
              <legend className="label">Character</legend>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {MASCOT_KINDS.map((k) => (
                  <label key={k.key} className={`flex cursor-pointer flex-col items-center rounded-lg border p-2 text-center text-[11px] ${mascotKind === k.key ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`} title={k.label}>
                    <input type="radio" name="mascotKind" value={k.key} checked={mascotKind === k.key} onChange={() => setMascotKind(k.key)} className="sr-only" />
                    <span className="text-2xl">{k.emoji}</span>
                    <span className="mt-1 leading-tight">{k.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="mascot" className="label">
                Face photo
              </label>
              <input
                id="mascot"
                name="mascot"
                type="file"
                accept="image/*"
                className="input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setMascotPreview(URL.createObjectURL(f));
                    setRemoveMascot(false);
                  }
                }}
              />
              <p className="mt-1 text-xs text-slate-500">A straight-on headshot works best. The photo is cropped to a circle; use the sliders to centre the face. Without a photo, a cartoon face is used.</p>
              {mascotPreview && !removeMascot && (
                <button type="button" onClick={() => { setRemoveMascot(true); setMascotPreview(null); }} className="mt-1 text-xs text-red-700 hover:underline">
                  Remove photo
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="mascotFaceZoom" className="label">
                  Zoom ({mascotZoom}%)
                </label>
                <input id="mascotFaceZoom" name="mascotFaceZoom" type="range" min={100} max={250} step={5} value={mascotZoom} onChange={(e) => setMascotZoom(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <label htmlFor="mascotFaceRotate" className="label">
                  Tilt ({mascotRotate}°)
                </label>
                <input id="mascotFaceRotate" name="mascotFaceRotate" type="range" min={-45} max={45} step={1} value={mascotRotate} onChange={(e) => setMascotRotate(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <label htmlFor="mascotFaceOffsetX" className="label">
                  Move face left / right ({mascotOffsetX})
                </label>
                <input id="mascotFaceOffsetX" name="mascotFaceOffsetX" type="range" min={-40} max={40} step={2} value={mascotOffsetX} onChange={(e) => setMascotOffsetX(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <label htmlFor="mascotFaceOffsetY" className="label">
                  Move face up / down ({mascotOffset})
                </label>
                <input id="mascotFaceOffsetY" name="mascotFaceOffsetY" type="range" min={-40} max={40} step={2} value={mascotOffset} onChange={(e) => setMascotOffset(Number(e.target.value))} className="w-full" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="mascotFaceFlip" checked={mascotFlip} onChange={(e) => setMascotFlip(e.target.checked)} className="h-4 w-4" />
                Mirror the photo
              </label>
              <button type="button" onClick={() => { setMascotZoom(100); setMascotOffsetX(0); setMascotOffset(0); setMascotRotate(0); setMascotFlip(false); }} className="text-xs text-blue-700 hover:underline">
                Reset face position
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="mascotCaption" className="label">
                  Caption (English)
                </label>
                <input id="mascotCaption" name="mascotCaption" value={mascotCaption} onChange={(e) => setMascotCaption(e.target.value)} className="input" placeholder="Happy holidays from Dave in Plant 2!" />
              </div>
              <div>
                <label htmlFor="mascotCaptionEs" className="label">
                  Caption (Spanish)
                </label>
                <input id="mascotCaptionEs" name="mascotCaptionEs" defaultValue={campaign.mascotCaptionEs} className="input" placeholder="¡Felices fiestas de parte de Dave!" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="mascotShowOnDone" defaultChecked={campaign.mascotShowOnDone} className="h-4 w-4" />
              Also show a small elf on the thank-you page
            </label>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save branding"}
        </button>
        {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
        {state?.success && <span className="text-sm text-emerald-700">{state.success}</span>}
      </div>
    </form>
  );
}
