import Link from "next/link";
import { dict } from "@/i18n";
import { getLang } from "@/lib/lang";
import { loadCampaign } from "./campaign";
import { A11yToggle } from "@/components/a11y-toggle";
import { pageThemeAttrs } from "@/lib/theme";

// Employee pages depend on cookies and live campaign data; never prerender at build time.
export const dynamic = "force-dynamic";

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
      className="min-h-screen"
      data-page-theme
      data-text={theme.textMode}
      data-card-style={theme.cardStyle}
      style={{ ...theme.style, ["--brand-primary" as string]: campaign.primaryColor, ["--brand-accent" as string]: campaign.accentColor }}
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={`/g/${campaign.slug}`} className="flex items-center gap-3 min-w-0">
            {campaign.logoImageId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/images/${campaign.logoImageId}`} alt={campaign.companyName ?? campaign.name} className="h-9 w-auto max-w-[160px] object-contain" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white text-lg">🎁</span>
            )}
            <span className="truncate font-semibold text-slate-800">{campaign.companyName ?? campaign.name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <A11yToggle labels={t.a11y} />
            <a
              href={`/g/${campaign.slug}/lang?set=${other}`}
              className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
              aria-label={`Switch language to ${t.switchTo}`}
            >
              {t.switchTo}
            </a>
          </div>
        </div>
      </header>
      {children}
      <footer className="theme-muted py-8 text-center text-xs text-slate-400">{t.poweredBy}</footer>
    </div>
  );
}
