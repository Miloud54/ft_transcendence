import Link from "next/link";
import Image from "next/image";
import { Footer } from "@/components/footer";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-center bg-violet-700 px-6 py-3">
        <Link href="/" className="flex items-center">
          <Image src="/logo-violet.png" alt="Transcendix" width={1526} height={582} className="h-16 w-auto" priority />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16">
        {children}
      </main>

      <Footer />
    </div>
  );
}
