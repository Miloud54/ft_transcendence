"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/current-user-context";
import { API_URL } from "@/lib/room-api";

type ActiveGame = { roomId: string; gameId: string } | null;

export function ActiveGameButton() {
  const { user } = useCurrentUser();
  const pathname = usePathname();
  const [activeGame, setActiveGame] = useState<ActiveGame>(null);

  useEffect(() => {
    if (user?.status !== "IN_GAME") {
      return;
    }

    const token = localStorage.getItem("accessToken");
    fetch(`${API_URL}/users/me/active-game`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then(setActiveGame)
      .catch(() => setActiveGame(null));
  }, [user?.status]);

  if (user?.status !== "IN_GAME" || !activeGame || pathname.startsWith("/game/")) {
    return null;
  }

  return (
    <Link
      href={`/game/${activeGame.gameId}?room=${activeGame.roomId}`}
      className="rounded-full bg-lime-400 px-3 py-1.5 text-xs font-semibold text-violet-950 hover:bg-lime-300"
    >
      Back to game
    </Link>
  );
}
