import Link from "next/link";
import { Footer } from "@/components/footer";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-center bg-violet-700 px-6 py-3">
        <Link href="/" className="flex items-center" aria-label="Transcendix">
          <video autoPlay loop muted playsInline className="h-16 w-auto lg:h-20" src="/logo-violet.mp4" />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16">
        {children}
      </main>

      <Footer />
    </div>
  );
}
