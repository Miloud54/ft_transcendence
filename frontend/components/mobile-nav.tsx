"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Toggle navigation"
        className="flex h-9 w-9 items-center justify-center rounded-md text-white hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-md bg-violet-800 p-2 shadow-lg">
          {items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-white/15 text-white" : "text-violet-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
