export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-4xl">🎁</div>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">Gift Portal Admin</h1>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </main>
  );
}
