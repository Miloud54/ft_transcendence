"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function GuestOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("accessToken")) {
      setShouldRedirect(true);
      router.replace("/home");
    }
  }, [router]);

  if (shouldRedirect) {
    return null;
  }

  return <>{children}</>;
}
