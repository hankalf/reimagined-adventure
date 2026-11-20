import { redirect } from "next/navigation";
import { dict, fill, localized } from "@/i18n";
import { closesAtInstant, formatCalendarDate } from "@/lib/time-zone";
import { getEmployeeSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { campaignAcceptsPicks, daysUntil } from "@/lib/selection-rules";
import { loadCampaign } from "./campaign";
import { IdentifyForm } from "./identify-form";
import { DancingMascot } from "@/components/dancing-mascot";
import { db } from "@/lib/db";
import { videoEmbed } from "@/lib/video";
import { landingMascotSize, mascotFaceProps } from "@/lib/mascot";

export default async function LandingPage({ params, searchParams }: PageProps<"/g/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const [campaign, lang] = await Promise.all([loadCampaign(slug), getLang()]);
  const t = dict(lang);

  const session = await getEmployeeSession(campaign.id);
  const previewing = Boolean(session?.preview && sp.preview === "1");
  if (session && !previewing) redirect(`/g/${slug}/pick`);
  const previewEmployee = previewing && session ? await db.employee.findUnique({ where: { id: session.employeeId } }) : null;
  const pickCount = campaign.showPickCount ? await db.selection.count({ where: { campaignId: campaign.id, status: { in: ["SELECTED", "ORDERED", "RECEIVED", "COLLECTED"] } } }) : 0;
  const video = videoEmbed(campaign.videoUrl);
  const mascots = campaign.mascotEnabled ? await db.campaignMascot.findMany({ where: { campaignId: campaign.id, showOnLanding: true }, orderBy: { sortOrder: "asc" } }) : [];

  const window = campaignAcceptsPicks(campaign);
  const headline = localized(lang, campaign.welcomeHeadline, campaign.welcomeHeadlineEs);
  const message = localized(lang, campaign.welcomeMessage, campaign.welcomeMessageEs);
  const leadership = campaign.leadershipMessage ? localized(lang, campaign.leadershipMessage, campaign.leadershipMessageEs) : null;

  const hasMore = pickCount >= 3 || Boolean(video) || Boolean(leadership) || mascots.length > 0;

  let deadline: string | null = null;
  if (campaign.closesAt && window.ok) {
    const days = daysUntil(closesAtInstant(campaign) ?? campaign.closesAt);
    deadline = days <= 1 ? t.landing.lastDay : fill(t.landing.daysLeft, { n: days });
  }

  return (
    <main className="safe-x mx-auto max-w-6xl py-6 md:py-12">
      {previewing && previewEmployee && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-preview-banner>
          {fill(t.landing.previewBanner, { name: `${previewEmployee.firstName} ${previewEmployee.lastName}` })}
        </div>
      )}
      {/* Phones: headline, then the sign-in card, then everything else. Wider screens: sign-in card on the right. */}
      <div className="grid gap-6 md:grid-cols-5 md:items-start md:gap-x-8 md:gap-y-0">
        <section className="md:col-span-3 md:row-start-1" data-landing-intro>
          {campaign.heroImageId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/images/${campaign.heroImageId}`} alt="" className="mb-5 h-40 w-full rounded-2xl object-cover shadow-sm sm:h-56 md:mb-6 md:h-72" />
          )}
          <h1 className="theme-text text-[1.75rem] leading-tight font-bold tracking-tight text-slate-900 sm:text-3xl md:text-4xl" style={{ color: campaign.primaryColor }}>
            {headline}
          </h1>
          {message && <p className="theme-muted mt-3 whitespace-pre-line text-base text-slate-700 sm:text-lg md:mt-4">{message}</p>}
          {deadline && (
            <p
              className="theme-pill mt-4 inline-flex flex-wrap items-center gap-x-2 rounded-2xl bg-accent/15 px-3 py-1.5 text-sm font-medium text-slate-800 sm:rounded-full"
              style={{ backgroundColor: `${campaign.accentColor}26` }}
            >
              ⏳ {deadline}
              {campaign.closesAt && <span className="text-slate-500">· {fill(t.landing.closesOn, { date: formatCalendarDate(campaign.closesAt, lang === "es" ? "es-US" : "en-US") })}</span>}
            </p>
          )}
        </section>

        <section className="md:col-span-2 md:col-start-4 md:row-span-2 md:row-start-1" data-landing-signin>
          <div className="card p-5 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{t.landing.enterDetails}</h2>
            {previewing ? (
              <a href={`/g/${slug}/pick`} className="btn w-full bg-brand py-3 text-base text-white hover:opacity-90">
                {t.landing.continue} →
              </a>
            ) : window.ok ? (
              <IdentifyForm slug={slug} t={t} requireLastName={campaign.requireLastName} />
            ) : (
              <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
                {window.reason === "draft" || window.reason === "not_yet_open" ? (
                  <>
                    {t.landing.campaignDraft}
                    {campaign.opensAt && <div className="mt-1 text-slate-500">{fill(t.landing.opensOn, { date: formatCalendarDate(campaign.opensAt, lang === "es" ? "es-US" : "en-US") })}</div>}
                  </>
                ) : (
                  t.landing.campaignClosed
                )}
              </div>
            )}
          </div>
        </section>

        {hasMore && (
        <section className="md:col-span-3 md:row-start-2" data-landing-more>
          {pickCount >= 3 && <p className="theme-muted mt-3 text-sm text-slate-600" data-pick-count>👥 {fill(t.landing.pickCount, { n: pickCount })}</p>}
          {video && (
            <div className="mt-4 overflow-hidden rounded-2xl bg-black shadow-sm md:mt-6" data-video>
              {video.kind === "iframe" ? (
                <iframe src={video.src} title={t.landing.watchVideo} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              ) : (
                <video src={video.src} controls playsInline className="aspect-video w-full" />
              )}
            </div>
          )}
          {leadership && (
            <blockquote className="mt-6 rounded-2xl border-l-4 bg-white p-5 shadow-sm md:mt-8" style={{ borderColor: campaign.accentColor }}>
              <p className="whitespace-pre-line text-slate-700 italic">“{leadership}”</p>
              {campaign.leadershipName && <footer className="mt-3 text-sm font-medium text-slate-600">— {campaign.leadershipName}</footer>}
            </blockquote>
          )}
          {mascots.length > 0 && (
            <div className="mt-6 flex flex-wrap items-end justify-center gap-4 md:mt-8 md:justify-start" data-landing-mascots>
              {mascots.map((m) => (
                <DancingMascot
                  key={m.id}
                  {...mascotFaceProps(m)}
                  caption={m.caption ? localized(lang, m.caption, m.captionEs) : null}
                  tapHint={t.mascot.tap}
                  size={landingMascotSize(mascots.length)}
                />
              ))}
            </div>
          )}
        </section>
        )}
      </div>
    </main>
  );
}
