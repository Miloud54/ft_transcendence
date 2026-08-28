import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-center bg-violet-700 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-white">
          <span className="h-6 w-6 rounded bg-lime-400" />
          Transcendix
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16">
        {children}
      </main>
    </div>
  );
}