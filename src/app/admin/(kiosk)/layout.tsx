// The kiosk reads live selection data; never prerender at build time.
export const dynamic = "force-dynamic";

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-900 text-white">{children}</div>;
}
