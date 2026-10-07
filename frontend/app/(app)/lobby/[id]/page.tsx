"use client";

import { use, useEffect, useState } from "react";
import { connectToRoom } from "@/lib/room-socket";
import { useRouter } from "next/navigation";
import { startRoom, type Room } from "@/lib/room-api";

export default function LobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
  const socket = connectToRoom(id, (nextRoom) => {
    setRoom(nextRoom as Room);
  }, (data) => {
    const started = data as { game: { id: string } };
    router.push(`/game/${started.game.id}?room=${id}`);
  });

  return () => {
    socket?.emit("room:leave", { roomId: id });
    socket?.disconnect();
  };
}, [id, router]);

  if (error) {
    return <p className="text-sm text-[#d03b3b]">{error}</p>;
  }

  if (!room) {
    return <p className="text-sm text-zinc-500">Loading room...</p>;
  }

  async function handleStart() {
    setError(null);
    setIsStarting(true);

    try {
      const result = await startRoom(id);
      router.push(`/game/${result.game.id}?room=${id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not start game");
    } finally {
      setIsStarting(false);
    }
  }

  const slots = Array.from({ length: room.maxPlayers }, (_, index) => room.players[index] ?? null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">Game lobby</h1>
        <p className="text-sm text-zinc-500">
          Waiting for players · Room #{room.id} · {room.players.length}/{room.maxPlayers}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((player, index) =>
          player ? (
            <div
              key={player.id}
              className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white p-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-lg font-semibold text-violet-700">
                {player.username.charAt(0)}
              </div>
              <span className="text-sm font-medium text-zinc-950">{player.username}</span>
              <span
                className="text-xs font-medium text-zinc-400"
              >
                {index === 0 ? "Host" : "In lobby"}
              </span>
            </div>
          ) : (
            <div
              key={`empty-${index}`}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 p-6 text-zinc-400"
            >
              <span className="text-xl">+</span>
              <span className="text-sm">Invite</span>
            </div>
          )
        )}
      </div>

      <button
        type="button"
        onClick={handleStart}
        disabled={
          isStarting ||
          room.status !== "open" ||
          room.players.length < room.minPlayers
        }
        className="w-full rounded-md bg-lime-400 py-3 text-sm font-semibold text-violet-900 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {isStarting ? "Starting..." : "Start game"}
      </button>
    </div>
  );
}
