import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 px-6 py-4 text-sm text-zinc-500">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>© {new Date().getFullYear()} Transcendix</span>
        <div className="flex gap-4">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
        </div>
      </div>
    </footer>
  );
}
