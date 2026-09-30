import Link from "next/link";
import { Footer } from "@/components/footer";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between bg-violet-700 px-6 py-2">
        <Link href="/" className="flex items-center" aria-label="Transcendix">
          <video autoPlay loop muted playsInline className="h-16 w-auto" src="/logo-violet.mp4" />
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-violet-100 hover:text-white">
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-violet-50"
          >
            Sign up
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <Footer />
    </div>
  );
}
