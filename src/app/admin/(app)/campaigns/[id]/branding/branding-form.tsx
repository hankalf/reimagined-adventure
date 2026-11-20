"use client";

import { useActionState, useState } from "react";
import { MascotsEditor, type MascotValues } from "./mascots-editor";
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
  mascots: MascotValues[];
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

  return (
    <form action={action} className="space-y-6" encType="multipart/form-data">
      <input type="hidden" name="id" value={campaign.id} />
      <input type="hidden" name="logoRemove" value={removeLogo ? "1" : "0"} />
      <input type="hidden" name="heroRemove" value={removeHero ? "1" : "0"} />

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

      <MascotsEditor initialEnabled={campaign.mascotEnabled} initialMascots={campaign.mascots} />

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
