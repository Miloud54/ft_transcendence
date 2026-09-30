import Link from "next/link";
import { Footer } from "@/components/footer";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between bg-violet-700 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-white">
          <span className="h-6 w-6 rounded bg-lime-400" />
          Transcendix
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
