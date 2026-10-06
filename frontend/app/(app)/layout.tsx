import Link from "next/link";
import { MainNav } from "@/components/main-nav";
import { Footer } from "@/components/footer";
import { CurrentUserProvider } from "@/lib/current-user-context";
import { CurrentUserBadge } from "@/components/current-user-badge";
import { AccountMenu } from "@/components/account-menu";
import { RoomChat } from "@/components/room-chat";
import { MobileNav } from "@/components/mobile-nav";

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
        <header className="flex items-center justify-between gap-6 bg-violet-700 px-6 py-2">
          <div className="flex items-center gap-8">
            <Link href="/home" className="flex items-center" aria-label="Transcendix">
              <video autoPlay loop muted playsInline className="h-16 w-auto lg:h-20" src="/logo-violet.mp4" />
            </Link>
            <MainNav items={NAV_ITEMS} />
          </div>

          <div className="flex items-center gap-4">
            <input
              type="search"
              placeholder="Search..."
              className="hidden rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white outline-none placeholder:text-violet-200 lg:block"
            />
            <MobileNav items={NAV_ITEMS} />
            <AccountMenu />
            <Link href="/dashboard">
              <CurrentUserBadge />
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>

        <Footer />
        <RoomChat />
      </div>
    </CurrentUserProvider>
  );
}
