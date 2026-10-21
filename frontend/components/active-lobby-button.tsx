"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/current-user-context";
import { getActiveRoom } from "@/lib/room-api";

export function ActiveLobbyButton() {
  const { user } = useCurrentUser();
  const pathname = usePathname();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const userId = user?.id;
  const onLobbyPage = pathname.startsWith("/lobby/");
  const onGamePage = pathname.startsWith("/game/");
  const isInGame = user?.status === "IN_GAME";

  useEffect(() => {
    if (!userId || onLobbyPage || onGamePage || isInGame) {
      return;
    }

    let cancelled = false;

    getActiveRoom()
      .then((room) => {
        if (cancelled) return;
        setActiveRoomId(room?.roomId ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setActiveRoomId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, onLobbyPage, onGamePage, isInGame, pathname]);

  if (!userId || onLobbyPage || onGamePage || isInGame || !activeRoomId) {
    return null;
  }

  return (
    <Link
      href={`/lobby/${activeRoomId}`}
      className="rounded-full bg-lime-400 px-3 py-1.5 text-xs font-semibold text-violet-950 hover:bg-lime-300"
    >
      Back to lobby
    </Link>
  );
}
