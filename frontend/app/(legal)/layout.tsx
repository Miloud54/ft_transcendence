import { CurrentUserProvider } from "@/lib/current-user-context";
import { LegalHeader } from "@/components/legal-header";
import { Footer } from "@/components/footer";

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CurrentUserProvider>
      <div className="flex min-h-full flex-1 flex-col">
        <LegalHeader />

        <main className="flex flex-1 flex-col">{children}</main>

        <Footer />
      </div>
    </CurrentUserProvider>
  );
}
