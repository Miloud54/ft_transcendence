"use client";

import { useCurrentUser } from "@/lib/current-user-context";

export function CurrentUserBadge() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading || !user) {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-violet-100" />;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-sm font-medium text-zinc-950">{user.username}</p>
      </div>
      <img
        src={user.avatar}
        alt={user.username}
        className="h-9 w-9 rounded-full bg-violet-100"
      />
    </div>
  );
}
