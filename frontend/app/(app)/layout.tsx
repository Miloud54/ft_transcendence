import Link from "next/link";
import { SidebarNav } from "@/components/sidebar-nav";
import { currentUser } from "@/lib/mock-data";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/games", label: "Mes parties" },
  { href: "/friends", label: "Amis" },
  { href: "/leaderboard", label: "Classement" },
  { href: "/settings", label: "Paramètres" },
];

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-1">
      <aside className="flex w-64 flex-none flex-col bg-violet-700 py-6 text-white">
        <Link href="/dashboard" className="flex items-center gap-2 px-4 font-semibold">
          <span className="h-6 w-6 rounded bg-lime-400" />
          Transcendix
        </Link>

        <input
          type="search"
          placeholder="Rechercher..."
          className="mx-4 mt-6 rounded-md bg-violet-600 px-3 py-2 text-sm text-white placeholder:text-violet-200 focus:outline-none"
        />

        <span className="mt-6 px-4 text-xs font-semibold uppercase tracking-wide text-violet-300">
          Menu
        </span>

        <div className="mt-2 flex-1">
          <SidebarNav items={NAV_ITEMS} />
        </div>

        <div className="mx-4 rounded-lg bg-violet-600 p-4 text-sm">
          <p className="font-medium">Lancer une partie dès maintenant</p>
          <button className="mt-3 w-full rounded-md bg-lime-400 py-2 text-sm font-semibold text-violet-900">
            Créer
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-zinc-200 px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-zinc-950">{currentUser.username}</p>
              <p className="text-xs text-zinc-500">{currentUser.email}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">
              {currentUser.username.charAt(0)}
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}