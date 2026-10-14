"use client";

import { use, useEffect, useState } from "react";
import { connectToRoom } from "@/lib/room-socket";
import { useRouter } from "next/navigation";
import { getFriends, inviteFriendToRoom, startRoom, type Friend, type Room } from "@/lib/room-api";
import { useCurrentUser } from "@/lib/current-user-context";

export default function LobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useCurrentUser();
  const [room, setRoom] = useState<Room | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
  const [invitedFriendIds, setInvitedFriendIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void getFriends().then(setFriends).catch(() => {
      setError("Could not load your friends.");
    });
  }, []);

  useEffect(() => {
    const handleFriendAccepted = (event: Event) => {
      const friend = (event as CustomEvent<Friend>).detail;
      setFriends((current) =>
        current.some((existing) => existing.id === friend.id) ? current : [...current, friend],
      );
    };
    const handleFriendRemoved = (event: Event) => {
      const { id } = (event as CustomEvent<{ id: string }>).detail;
      setFriends((current) => current.filter((friend) => friend.id !== id));
    };
    const handlePresenceUpdate = (event: Event) => {
      const update = (event as CustomEvent<{ id: string; status: "ONLINE" | "OFFLINE" | "IN_GAME" }>).detail;
      setFriends((current) =>
        current.map((friend) => (friend.id === update.id ? { ...friend, status: update.status } : friend)),
      );
    };

    window.addEventListener("friend-request:accepted", handleFriendAccepted);
    window.addEventListener("friend:removed", handleFriendRemoved);
    window.addEventListener("presence:update", handlePresenceUpdate);
    return () => {
      window.removeEventListener("friend-request:accepted", handleFriendAccepted);
      window.removeEventListener("friend:removed", handleFriendRemoved);
      window.removeEventListener("presence:update", handlePresenceUpdate);
    };
  }, []);

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

  async function handleInvite(friend: Friend) {
    setError(null);
    setInvitingFriendId(friend.id);
    try {
      await inviteFriendToRoom(id, friend.id);
      setInvitedFriendIds((current) => new Set(current).add(friend.id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not invite friend");
    } finally {
      setInvitingFriendId(null);
    }
  }

  const slots = Array.from({ length: room.maxPlayers }, (_, index) => room.players[index] ?? null);
  const isHost = user?.id === room.hostId;
  const roomPlayerIds = new Set(room.players.map((player) => player.id));

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

      {isHost && (
        <section className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
          <h2 className="text-sm font-semibold text-violet-950">Invite friends</h2>
          <p className="mt-1 text-xs text-violet-700">
            Add friends from your friend list to this game.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {friends.length === 0 ? (
              <p className="text-sm text-zinc-500">You do not have any accepted friends yet.</p>
            ) : (
              friends.map((friend) => {
                const alreadyInRoom = roomPlayerIds.has(friend.id);
                return (
                  <button
                    key={friend.id}
                    type="button"
                    disabled={alreadyInRoom || invitingFriendId !== null || room.players.length >= room.maxPlayers || friend.status !== "ONLINE"}
                    onClick={() => void handleInvite(friend)}
                    className="flex items-center gap-2 rounded-md border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        friend.status === "ONLINE"
                          ? "bg-lime-400"
                          : friend.status === "IN_GAME"
                            ? "bg-violet-500"
                            : "bg-zinc-300"
                      }`}
                    />
                    <span>
                      {alreadyInRoom
                        ? `${friend.username} is in`
                        : invitedFriendIds.has(friend.id)
                          ? `Invitation sent to ${friend.username}`
                        : invitingFriendId === friend.id
                          ? `Adding ${friend.username}...`
                        : friend.status !== "ONLINE"
                          ? `${friend.username} is unavailable`
                          : `Add ${friend.username}`}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        friend.status === "ONLINE"
                          ? "bg-lime-100 text-lime-800"
                          : friend.status === "IN_GAME"
                            ? "bg-violet-100 text-violet-700"
                            : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {friend.status === "ONLINE" ? "Online" : friend.status === "IN_GAME" ? "In game" : "Offline"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      )}

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
