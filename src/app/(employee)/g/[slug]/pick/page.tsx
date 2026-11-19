import { redirect } from "next/navigation";
import { dict, fill, formatMoney, localized } from "@/i18n";
import { getEmployeeSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { getPickContext } from "@/lib/selection";
import { campaignAcceptsPicks, canChangeSelection } from "@/lib/selection-rules";
import { loadCampaign } from "../campaign";
import { GiftGrid } from "./gift-grid";

export default async function PickPage({ params, searchParams }: PageProps<"/g/[slug]/pick">) {
  const { slug } = await params;
  const sp = await searchParams;
  const [campaign, lang] = await Promise.all([loadCampaign(slug), getLang()]);
  const t = dict(lang);
  const session = await getEmployeeSession(campaign.id);
  if (!session) redirect(`/g/${slug}`);
  if (!session.preview && !campaignAcceptsPicks(campaign).ok) redirect(`/g/${slug}`);

  const ctx = await getPickContext(campaign.id, session.employeeId);
  const wantsChange = sp.change === "1";
  if (ctx.selection && !session.preview) {
    const changeable = canChangeSelection(ctx.selection.status, campaign.allowChangeUntilOrdered);
    if (!changeable || (!wantsChange && ctx.selection.status !== "NEEDS_REPICK")) redirect(`/g/${slug}/done`);
  }

  const repick = ctx.selection?.status === "NEEDS_REPICK" && !session.preview;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {session.preview && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-preview-banner>
          {fill(t.landing.previewBanner, { name: `${ctx.employee.firstName} ${ctx.employee.lastName}` })}
        </div>
      )}
      {repick && ctx.selection && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900">{t.done.repickTitle}</h2>
          <p className="mt-1 text-sm text-amber-900">{fill(t.done.repickBody, { item: localized(lang, ctx.selection.item.name, ctx.selection.item.nameEs) })}</p>
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{fill(t.pick.greeting, { name: ctx.employee.firstName })}</h1>
          <p className="mt-1 text-slate-600">{t.pick.chooseOne}</p>
          {campaign.showBudgetToEmployees && ctx.budget !== null && ctx.budget > 0 && (
            <p className="mt-1 text-sm font-medium text-slate-700">{fill(t.pick.yourBudget, { amount: formatMoney(ctx.budget, campaign.currency, lang) })}</p>
          )}
        </div>
        <a href={`/g/${slug}/logout`} className="text-sm text-slate-500 underline-offset-2 hover:underline">
          {fill(t.pick.notYou, { name: ctx.employee.firstName })}
        </a>
      </div>
      <GiftGrid
        slug={slug}
        lang={lang}
        t={t}
        items={ctx.items}
        currentItemId={ctx.selection?.itemId ?? null}
        allowChange={campaign.allowChangeUntilOrdered}
      />
    </main>
  );
}
