import { GuestHeader } from "@/components/guest-header";
import { Footer } from "@/components/footer";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <GuestHeader />

      <main className="flex flex-1 flex-col">{children}</main>

      <Footer />
    </div>
  );
}
