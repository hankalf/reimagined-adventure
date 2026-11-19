import { redirect } from "next/navigation";
import { dict, fill, formatDate, localized } from "@/i18n";
import { getEmployeeSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { campaignAcceptsPicks, daysUntil } from "@/lib/selection-rules";
import { loadCampaign } from "./campaign";
import { IdentifyForm } from "./identify-form";

export default async function LandingPage({ params }: PageProps<"/g/[slug]">) {
  const { slug } = await params;
  const [campaign, lang] = await Promise.all([loadCampaign(slug), getLang()]);
  const t = dict(lang);

  const session = await getEmployeeSession(campaign.id);
  if (session) redirect(`/g/${slug}/pick`);

  const window = campaignAcceptsPicks(campaign);
  const headline = localized(lang, campaign.welcomeHeadline, campaign.welcomeHeadlineEs);
  const message = localized(lang, campaign.welcomeMessage, campaign.welcomeMessageEs);
  const leadership = campaign.leadershipMessage ? localized(lang, campaign.leadershipMessage, campaign.leadershipMessageEs) : null;

  let deadline: string | null = null;
  if (campaign.closesAt && window.ok) {
    const days = daysUntil(campaign.closesAt);
    deadline = days <= 1 ? t.landing.lastDay : fill(t.landing.daysLeft, { n: days });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <div className="grid gap-8 md:grid-cols-5 md:items-start">
        <section className="md:col-span-3">
          {campaign.heroImageId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/images/${campaign.heroImageId}`} alt="" className="mb-6 h-56 w-full rounded-2xl object-cover shadow-sm md:h-72" />
          )}
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl" style={{ color: campaign.primaryColor }}>
            {headline}
          </h1>
          {message && <p className="mt-4 whitespace-pre-line text-lg text-slate-700">{message}</p>}
          {deadline && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-slate-800" style={{ backgroundColor: `${campaign.accentColor}26` }}>
              ⏳ {deadline}
              {campaign.closesAt && <span className="text-slate-500">· {fill(t.landing.closesOn, { date: formatDate(campaign.closesAt, lang) })}</span>}
            </p>
          )}
          {leadership && (
            <blockquote className="mt-8 rounded-2xl border-l-4 bg-white p-5 shadow-sm" style={{ borderColor: campaign.accentColor }}>
              <p className="whitespace-pre-line text-slate-700 italic">“{leadership}”</p>
              {campaign.leadershipName && <footer className="mt-3 text-sm font-medium text-slate-600">— {campaign.leadershipName}</footer>}
            </blockquote>
          )}
        </section>

        <section className="md:col-span-2">
          <div className="card p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{t.landing.enterDetails}</h2>
            {window.ok ? (
              <IdentifyForm slug={slug} t={t} requireLastName={campaign.requireLastName} />
            ) : (
              <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
                {window.reason === "draft" || window.reason === "not_yet_open" ? (
                  <>
                    {t.landing.campaignDraft}
                    {campaign.opensAt && <div className="mt-1 text-slate-500">{fill(t.landing.opensOn, { date: formatDate(campaign.opensAt, lang) })}</div>}
                  </>
                ) : (
                  t.landing.campaignClosed
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
