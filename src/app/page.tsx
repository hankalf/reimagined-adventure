import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="text-5xl">🎁</div>
      <h1 className="text-2xl font-semibold">Employee Gift Portal</h1>
      <p className="text-slate-600">
        Employees reach their gift program by scanning the QR code posted in the building. If you are an administrator, sign in below.
      </p>
      <Link href="/admin" className="btn-primary">
        Admin sign in
      </Link>
    </main>
  );
}
