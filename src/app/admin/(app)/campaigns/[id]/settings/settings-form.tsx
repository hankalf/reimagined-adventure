"use client";

import { useActionState } from "react";
import { deleteCampaignAction, setCampaignStatusAction, updateCampaignSettingsAction, type FormState } from "../../actions";

type Settings = {
  id: string;
  name: string;
  slug: string;
  status: string;
  opensAt: string;
  closesAt: string;
  currency: string;
  requireLastName: boolean;
  allowChangeUntilOrdered: boolean;
  showSoldOutItems: boolean;
  hideItemsOverBudget: boolean;
  allEmployeesEligible: boolean;
  hrEmails: string;
  totalBudget: string;
  defaultEmployeeBudget: string;
};

function Toggle({ name, label, hint, checked }: { name: string; label: string; hint: string; checked: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 h-4 w-4" />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );
}

export function SettingsForm({ campaign, canDelete, selectionCount }: { campaign: Settings; canDelete: boolean; selectionCount: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateCampaignSettingsAction, null);
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-6">
        <input type="hidden" name="id" value={campaign.id} />
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Basics</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="name" className="label">
                Name
              </label>
              <input id="name" name="name" defaultValue={campaign.name} className="input" required />
            </div>
            <div>
              <label htmlFor="slug" className="label">
                Link (/g/…) — changing it breaks printed QR codes
              </label>
              <input id="slug" name="slug" defaultValue={campaign.slug} className="input font-mono" required />
            </div>
            <div>
              <label htmlFor="opensAt" className="label">
                Opens (optional)
              </label>
              <input id="opensAt" name="opensAt" type="date" defaultValue={campaign.opensAt} className="input" />
            </div>
            <div>
              <label htmlFor="closesAt" className="label">
                Selections close (optional)
              </label>
              <input id="closesAt" name="closesAt" type="date" defaultValue={campaign.closesAt} className="input" />
            </div>
            <div>
              <label htmlFor="hrEmails" className="label">
                HR order emails go to
              </label>
              <input id="hrEmails" name="hrEmails" defaultValue={campaign.hrEmails} className="input" placeholder="hr@company.com, purchasing@company.com" />
            </div>
            <div>
              <label htmlFor="currency" className="label">
                Currency
              </label>
              <input id="currency" name="currency" defaultValue={campaign.currency} className="input w-28 uppercase" maxLength={3} />
            </div>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Budget</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="totalBudget" className="label">
                Total campaign budget
              </label>
              <input id="totalBudget" name="totalBudget" defaultValue={campaign.totalBudget} inputMode="decimal" className="input" placeholder="e.g. 5000" />
            </div>
            <div>
              <label htmlFor="defaultEmployeeBudget" className="label">
                Default budget per employee
              </label>
              <input id="defaultEmployeeBudget" name="defaultEmployeeBudget" defaultValue={campaign.defaultEmployeeBudget} inputMode="decimal" className="input" placeholder="e.g. 75" />
              <p className="mt-1 text-xs text-slate-500">Override per person on the Employees tab or with a budget column in the CSV.</p>
            </div>
          </div>
          <Toggle name="hideItemsOverBudget" label="Hide gifts that cost more than the employee's budget" hint="Off: they are shown greyed out with an “over your budget” badge and cannot be chosen." checked={campaign.hideItemsOverBudget} />
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Rules</h2>
          <Toggle name="requireLastName" label="Ask for last name as well as employee number" hint="Recommended. Prevents someone picking with a colleague's number alone." checked={campaign.requireLastName} />
          <Toggle name="allowChangeUntilOrdered" label="Let employees change their gift until HR marks it ordered" hint="Off: the first confirmed choice is final." checked={campaign.allowChangeUntilOrdered} />
          <Toggle name="showSoldOutItems" label="Show sold-out gifts (greyed out) instead of hiding them" hint="Helps employees understand why an item they heard about is unavailable." checked={campaign.showSoldOutItems} />
          <Toggle name="allEmployeesEligible" label="All active employees are eligible" hint="Off: only people uploaded on this campaign's Employees tab can pick." checked={campaign.allEmployeesEligible} />
        </section>

        <div className="flex items-center gap-3">
          <button disabled={pending} className="btn-primary">
            {pending ? "Saving…" : "Save settings"}
          </button>
          {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
          {state?.success && <span className="text-sm text-emerald-700">{state.success}</span>}
        </div>
      </form>

      <section className="card p-5">
        <h2 className="font-semibold">Status</h2>
        <p className="mt-1 text-xs text-slate-500">Draft: employees see “not open yet”. Open: employees can pick. Closed: no more picks, HR keeps working the order list.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["DRAFT", "OPEN", "CLOSED"] as const).map((s) => (
            <form key={s} action={setCampaignStatusAction}>
              <input type="hidden" name="id" value={campaign.id} />
              <input type="hidden" name="status" value={s} />
              <button className={campaign.status === s ? "btn-primary" : "btn-secondary"} disabled={campaign.status === s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            </form>
          ))}
        </div>
      </section>

      {canDelete && (
        <section className="card border-red-200 p-5">
          <h2 className="font-semibold text-red-800">Delete campaign</h2>
          <p className="mt-1 text-sm text-slate-600">Removes the campaign, its {selectionCount} selection(s) and email history. Catalog gifts and employees are kept.</p>
          <form action={deleteCampaignAction} className="mt-3">
            <input type="hidden" name="id" value={campaign.id} />
            <button
              className="btn-danger"
              onClick={(e) => {
                if (!window.confirm(`Delete “${campaign.name}” and all ${selectionCount} selections? This cannot be undone.`)) e.preventDefault();
              }}
            >
              Delete campaign
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
