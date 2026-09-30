"use client";

import { useCurrentUser } from "@/lib/current-user-context";

export function CurrentUserBadge() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading || !user) {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-white/20" />;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-sm font-medium text-white">{user.username}</p>
      </div>
      <img
        src={user.avatar}
        alt={user.username}
        className="h-9 w-9 rounded-full bg-white/20 ring-2 ring-lime-400 ring-offset-2 ring-offset-violet-700"
      />
    </div>
  );
}
