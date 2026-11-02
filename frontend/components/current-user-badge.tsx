"use client";

import { useCurrentUser } from "@/lib/current-user-context";

export function CurrentUserBadge() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading || !user) {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-white/20" />;
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="hidden min-w-0 max-w-40 text-right sm:block">
        <p className="truncate text-sm font-medium text-white" title={user.username}>{user.username}</p>
      </div>
      <img
        src={user.avatar}
        alt={user.username}
        className="h-9 w-9 rounded-full bg-white/20 ring-2 ring-lime-400 ring-offset-2 ring-offset-violet-700"
      />
    </div>
  );
}
