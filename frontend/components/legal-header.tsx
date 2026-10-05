"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/current-user-context";
import { MainNav } from "@/components/main-nav";
import { AccountMenu } from "@/components/account-menu";
import { CurrentUserBadge } from "@/components/current-user-badge";

const NAV_ITEMS = [
  { href: "/home", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/games", label: "My games" },
  { href: "/friends", label: "Friends" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function LegalHeader() {
  const { user, isLoading } = useCurrentUser();

  if (!isLoading && user) {
    return (
      <header className="flex items-center justify-between gap-6 bg-violet-700 px-6 py-2">
        <div className="flex items-center gap-8">
          <Link href="/home" className="flex items-center" aria-label="Transcendix">
            <video autoPlay loop muted playsInline className="h-16 w-auto" src="/logo-violet.mp4" />
          </Link>
          <MainNav items={NAV_ITEMS} />
        </div>

        <div className="flex items-center gap-4">
          <input
            type="search"
            placeholder="Search..."
            className="hidden rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white outline-none placeholder:text-violet-200 sm:block"
          />
          <AccountMenu />
          <Link href="/dashboard">
            <CurrentUserBadge />
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="flex items-center bg-violet-700 px-6 py-2">
      <Link href="/" className="flex items-center" aria-label="Transcendix">
        <video autoPlay loop muted playsInline className="h-16 w-auto" src="/logo-violet.mp4" />
      </Link>
    </header>
  );
}
