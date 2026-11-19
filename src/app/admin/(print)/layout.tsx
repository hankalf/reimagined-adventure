// The poster reads campaign data; never prerender at build time.
export const dynamic = "force-dynamic";

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-200 text-slate-900 print:min-h-0 print:bg-white">{children}</div>;
}
