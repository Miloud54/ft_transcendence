import Link from "next/link";
import { MainNav } from "@/components/main-nav";
import { Footer } from "@/components/footer";
import { CurrentUserProvider } from "@/lib/current-user-context";
import { CurrentUserBadge } from "@/components/current-user-badge";
import { AccountMenu } from "@/components/account-menu";

const NAV_ITEMS = [
  { href: "/home", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/games", label: "My games" },
  { href: "/friends", label: "Friends" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CurrentUserProvider>
      <div className="flex min-h-full flex-1 flex-col">
        <header className="flex items-center justify-between gap-6 border-b border-zinc-200 bg-white px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/home" className="flex items-center gap-2 font-semibold text-zinc-950">
              <span className="h-6 w-6 rounded bg-lime-400" />
              Transcendix
            </Link>
            <MainNav items={NAV_ITEMS} />
          </div>

          <div className="flex items-center gap-4">
            <input
              type="search"
              placeholder="Search..."
              className="hidden rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm outline-none placeholder:text-zinc-400 sm:block"
            />
            <AccountMenu />
            <Link href="/dashboard">
              <CurrentUserBadge />
            </Link>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">{children}</main>

        <Footer />
      </div>
    </CurrentUserProvider>
  );
}
