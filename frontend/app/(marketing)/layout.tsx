import Link from "next/link";
import { Footer } from "@/components/footer";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="h-6 w-6 rounded bg-lime-400" />
          Transcendix
        </Link>
        <nav className="flex items-center gap-6 text-sm text-zinc-600">
          <Link href="/how-to-play">How to play</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/login" className="font-medium text-zinc-950">
            Account
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <Footer />
    </div>
  );
}