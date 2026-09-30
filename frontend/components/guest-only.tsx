"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return localStorage.getItem("accessToken") !== null;
}

function getServerSnapshot() {
  return false;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isLoggedIn = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (isLoggedIn) {
      router.replace("/home");
    }
  }, [isLoggedIn, router]);

  if (isLoggedIn) {
    return null;
  }

  return <>{children}</>;
}
