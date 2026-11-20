import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { dict } from "@/i18n";
import { getLang } from "@/lib/lang";
import { loadCampaign } from "./campaign";
import { A11yToggle } from "@/components/a11y-toggle";
import { pageThemeAttrs } from "@/lib/theme";

// Employee pages depend on cookies and live campaign data; never prerender at build time.
export const dynamic = "force-dynamic";

/** Phones: edge-to-edge (content padded clear of the notch and home bar), browser bar in the brand colour. */
export async function generateViewport({ params }: LayoutProps<"/g/[slug]">): Promise<Viewport> {
  const { slug } = await params;
  const campaign = await loadCampaign(slug);
  return { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: campaign.primaryColor };
}

export async function generateMetadata({ params }: LayoutProps<"/g/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await loadCampaign(slug);
  const title = campaign.companyName ? `${campaign.welcomeHeadline} · ${campaign.companyName}` : campaign.welcomeHeadline;
  return {
    title,
    // Employee numbers and confirmation codes must not turn into phone-number links on iPhone.
    formatDetection: { telephone: false, email: false, address: false },
    appleWebApp: { title: campaign.companyName ?? campaign.name, statusBarStyle: "default" },
  };
}

export default async function EmployeeLayout({ children, params }: LayoutProps<"/g/[slug]">) {
  const { slug } = await params;
  const [campaign, lang] = await Promise.all([loadCampaign(slug), getLang()]);
  const t = dict(lang);
  const other = lang === "en" ? "es" : "en";
  const theme = pageThemeAttrs({
    bgPattern: campaign.bgPattern,
    bgColor: campaign.bgColor,
    bgColor2: campaign.bgColor2,
    bgImageUrl: campaign.bgImageId ? `/api/images/${campaign.bgImageId}` : null,
    bgOverlay: campaign.bgOverlay,
    textMode: campaign.textMode,
    fontStyle: campaign.fontStyle,
    cardStyle: campaign.cardStyle,
    accentColor: campaign.accentColor,
  });
  return (
    <div
      className="page-min-h flex flex-col"
      data-page-theme
      data-text={theme.textMode}
      data-card-style={theme.cardStyle}
      style={{ ...theme.style, ["--brand-primary" as string]: campaign.primaryColor, ["--brand-accent" as string]: campaign.accentColor }}
    >
      <header className="safe-top border-b border-slate-200 bg-white">
        <div className="safe-x mx-auto flex max-w-6xl items-center justify-between gap-2 py-2.5 sm:gap-4 sm:py-3">
          <Link href={`/g/${campaign.slug}`} className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            {campaign.logoImageId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/images/${campaign.logoImageId}`} alt={campaign.companyName ?? campaign.name} className="h-8 w-auto max-w-[110px] object-contain sm:h-9 sm:max-w-[160px]" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-lg text-white sm:h-9 sm:w-9">🎁</span>
            )}
            <span className="truncate text-sm font-semibold text-slate-800 sm:text-base">{campaign.companyName ?? campaign.name}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <A11yToggle labels={t.a11y} />
            <a
              href={`/g/${campaign.slug}/lang?set=${other}`}
              className="flex min-h-9 items-center rounded-full border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
              aria-label={`Switch language to ${t.switchTo}`}
              lang={other}
            >
              {t.switchTo}
            </a>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="theme-muted safe-bottom pt-8 text-center text-xs text-slate-400">{t.poweredBy}</footer>
    </div>
  );
}
