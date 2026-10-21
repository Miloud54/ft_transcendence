"use client";

import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { connectToRoom } from "@/lib/room-socket";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addFriend,
  getFriendRequests,
  getFriends,
  inviteFriendToRoom,
  leaveRoom,
  removePlayerFromRoom,
  startRoom,
  type Friend,
  type FriendRequest,
  type Room, 
} from "@/lib/room-api";
import { useCurrentUser } from "@/lib/current-user-context";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

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
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
  const [invitedFriendIds, setInvitedFriendIds] = useState<Set<string>>(new Set());
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
  const [sentFriendRequestIds, setSentFriendRequestIds] = useState<Set<string>>(new Set());
  const [codeCopied, setCodeCopied] = useState(false);
  const [isLeavingLobby, setIsLeavingLobby] = useState(false);
  const [removingPlayerId, setRemovingPlayerId] = useState<string | null>(null);

  async function handleCopyCode() {
    if (!room) return;
    await navigator.clipboard.writeText(room.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function handleLeaveLobby() {
    setError(null);
    setIsLeavingLobby(true);
    try {
      await leaveRoom(id);
      router.push("/home");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not leave the lobby");
      setIsLeavingLobby(false);
    }
  }

  async function handleRemovePlayer(player: Room["players"][number]) {
    if (!window.confirm(`Remove ${player.username} from this lobby?`)) return;
    setError(null);
    setRemovingPlayerId(player.id);
    try {
      await removePlayerFromRoom(id, player.id);
      setInvitedFriendIds((current) => {
        const next = new Set(current);
        next.delete(player.id);
        return next;
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not remove player");
    } finally {
      setRemovingPlayerId(null);
    }
  }

  useEffect(() => {
    void Promise.all([getFriends(), getFriendRequests()])
      .then(([loadedFriends, loadedRequests]) => {
        setFriends(loadedFriends);
        setFriendRequests(loadedRequests);
      })
      .catch(() => {
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
    const onRemoved = (event: Event) => {
      const { roomId } = (event as CustomEvent<{ roomId: string }>).detail;
      if (roomId === id) {
        router.push("/home?removed=lobby");
      }
    };
    window.addEventListener("room:removed", onRemoved);
    return () => window.removeEventListener("room:removed", onRemoved);
  }, [id, router]);

  useEffect(() => {
    const onInvitationDeclined = (event: Event) => {
      const { roomId, friendId } = (event as CustomEvent<{ roomId: string; friendId: string }>).detail;
      if (roomId !== id) return;
      setInvitedFriendIds((current) => {
        if (!current.has(friendId)) return current;
        const next = new Set(current);
        next.delete(friendId);
        return next;
      });
    };
    window.addEventListener("room-invitation:declined", onInvitationDeclined);
    return () => window.removeEventListener("room-invitation:declined", onInvitationDeclined);
  }, [id]);

  useEffect(() => {
    if (!room) return;
    const currentPlayerIds = new Set(room.players.map((player) => player.id));
    setInvitedFriendIds((current) => {
      let changed = false;
      const next = new Set(current);
      for (const playerId of current) {
        if (currentPlayerIds.has(playerId)) {
          next.delete(playerId);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [room]);

  useEffect(() => {
  const socket = connectToRoom(id, (nextRoom) => {
    setRoom(nextRoom as Room);
  }, (data) => {
    const started = data as { game: { id: string } };
    router.push(`/game/${started.game.id}?room=${id}`);
  });

  return () => {
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

  async function handleAddFriend(player: Room["players"][number]) {
    setError(null);
    setAddingFriendId(player.id);
    try {
      await addFriend(player.id);
      setSentFriendRequestIds((current) => new Set(current).add(player.id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not add friend");
    } finally {
      setAddingFriendId(null);
    }
  }

  const slots = Array.from({ length: room.maxPlayers }, (_, index) => room.players[index] ?? null);
  const isHost = user?.id === room.hostId;
  const roomPlayerIds = new Set(room.players.map((player) => player.id));
  const friendIds = new Set(friends.map((friend) => friend.id));
  const incomingRequestIds = new Set(friendRequests.map((request) => request.id));

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="space-y-6"
    >
      <motion.div
        variants={fadeUp}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Game lobby</h1>
          <p className="text-sm text-zinc-500">
            Waiting for players · Room #{room.id} · {room.players.length}/{room.maxPlayers}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleCopyCode()}
          title="Copy room code"
          className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2 hover:bg-zinc-50"
        >
          <div className="text-left">
            <span className="block text-xs text-zinc-400">Room code</span>
            <strong className="font-mono text-lg tracking-widest text-violet-700">{room.code}</strong>
          </div>
          <span className="text-xs font-medium text-zinc-400">{codeCopied ? "Copied!" : "Copy"}</span>
        </button>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {slots.map((player, index) =>
          player ? (
            <motion.div
              key={player.id}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white p-6"
            >
              <Link href={`/dashboard?user=${encodeURIComponent(player.id)}`} className="flex flex-col items-center gap-2 hover:underline">
                <img src={player.avatarUrl} alt={player.username} className="h-12 w-12 rounded-full bg-violet-100 object-cover" />
                <span className="text-sm font-medium text-zinc-950">{player.username}</span>
                <span className="text-xs font-medium text-zinc-400">
                  {index === 0 ? "Host" : "In lobby"}
                </span>
              </Link>
              {user?.id !== player.id && !friendIds.has(player.id) && (
                <button
                  type="button"
                  disabled={
                    addingFriendId !== null ||
                    sentFriendRequestIds.has(player.id) ||
                    incomingRequestIds.has(player.id)
                  }
                  onClick={() => void handleAddFriend(player)}
                  className="mt-1 rounded-md border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sentFriendRequestIds.has(player.id)
                    ? "Friend request sent"
                    : incomingRequestIds.has(player.id)
                      ? "Request pending"
                      : addingFriendId === player.id
                        ? "Adding..."
                        : "Add friend"}
                </button>
              )}
              {isHost && player.id !== room.hostId && (
                <button
                  type="button"
                  disabled={removingPlayerId === player.id}
                  onClick={() => void handleRemovePlayer(player)}
                  className="mt-1 rounded-md border border-[#d03b3b] px-2 py-0.5 text-[10px] font-semibold text-[#d03b3b] transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {removingPlayerId === player.id ? "Removing..." : "Remove"}
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={`empty-${index}`}
              variants={fadeUp}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 p-6 text-zinc-400"
            >
              <span className="text-xl">+</span>
              <span className="text-sm">Invite</span>
            </motion.div>
          )
        )}
      </motion.div>

      {isHost && (
        <motion.section
          variants={fadeUp}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="rounded-xl border border-violet-100 bg-violet-50/60 p-4"
        >
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
                    <img src={friend.avatar} alt="" className="h-5 w-5 rounded-full bg-zinc-100 object-cover" />
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
        </motion.section>
      )}

      <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }} className="flex flex-col gap-3 sm:flex-row">
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
        {!isHost && (
          <button
            type="button"
            onClick={() => void handleLeaveLobby()}
            disabled={isLeavingLobby}
            className="w-full rounded-md border border-zinc-300 py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {isLeavingLobby ? "Leaving..." : "Leave lobby"}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}