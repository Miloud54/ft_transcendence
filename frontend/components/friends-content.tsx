"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { API_URL } from "@/lib/room-api";

type Friend = {
  id: string;
  username: string;
  avatar: string;
  status: "ONLINE" | "OFFLINE";
  relationship?: "NONE" | "PENDING_SENT" | "PENDING_RECEIVED" | "ACCEPTED";
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export function FriendsContent() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<Friend[]>([]);
  const [results, setResults] = useState<Friend[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function request<T>(path: string, options: RequestInit = {}) {
    const token = localStorage.getItem("accessToken");
    const headers = new Headers(options.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message ?? "Unable to load friends.");
    }
    return data as T;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadFriends() {
      try {
        const [data, incomingRequests] = await Promise.all([
          request<Friend[]>("/users/me/friends"),
          request<Friend[]>("/users/me/friend-requests"),
        ]);
        if (!cancelled) {
          setFriends(data);
          setRequests(incomingRequests);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load friends.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadFriends();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleRequestReceived = (event: Event) => {
      const requester = (event as CustomEvent<Friend>).detail;
      setRequests((currentRequests) =>
        currentRequests.some((request) => request.id === requester.id)
          ? currentRequests
          : [...currentRequests, requester].sort((a, b) => a.username.localeCompare(b.username)),
      );
      setResults((currentResults) =>
        currentResults.map((result) =>
          result.id === requester.id ? { ...result, relationship: "PENDING_RECEIVED" } : result,
        ),
      );
    };
    const handleRequestAccepted = (event: Event) => {
      const friend = (event as CustomEvent<Friend>).detail;
      setFriends((currentFriends) =>
        currentFriends.some((currentFriend) => currentFriend.id === friend.id)
          ? currentFriends
          : [...currentFriends, friend].sort((a, b) => a.username.localeCompare(b.username)),
      );
      setResults((currentResults) =>
        currentResults.map((result) =>
          result.id === friend.id ? { ...result, relationship: "ACCEPTED" } : result,
        ),
      );
    };
    const handleRequestDeclined = (event: Event) => {
      const { id } = (event as CustomEvent<{ id: string }>).detail;
      setResults((currentResults) =>
        currentResults.map((result) =>
          result.id === id ? { ...result, relationship: "NONE" } : result,
        ),
      );
    };
    const handleFriendRemoved = (event: Event) => {
      const removedFriend = (event as CustomEvent<Friend>).detail;
      setFriends((currentFriends) =>
        currentFriends.filter((friend) => friend.id !== removedFriend.id),
      );
      setResults((currentResults) =>
        currentResults.map((result) =>
          result.id === removedFriend.id ? { ...result, relationship: "NONE" } : result,
        ),
      );
    };

    window.addEventListener("friend-request:received", handleRequestReceived);
    window.addEventListener("friend-request:accepted", handleRequestAccepted);
    window.addEventListener("friend-request:declined", handleRequestDeclined);
    window.addEventListener("friend:removed", handleFriendRemoved);
    return () => {
      window.removeEventListener("friend-request:received", handleRequestReceived);
      window.removeEventListener("friend-request:accepted", handleRequestAccepted);
      window.removeEventListener("friend-request:declined", handleRequestDeclined);
      window.removeEventListener("friend:removed", handleFriendRemoved);
    };
  }, []);

  useEffect(() => {
    const handlePresenceUpdate = (event: Event) => {
      const update = (event as CustomEvent<{ id: string; status: "ONLINE" | "OFFLINE" }>).detail;
      setFriends((currentFriends) =>
        currentFriends.map((friend) =>
          friend.id === update.id ? { ...friend, status: update.status } : friend,
        ),
      );
      setResults((currentResults) =>
        currentResults.map((result) =>
          result.id === update.id ? { ...result, status: update.status } : result,
        ),
      );
    };

    window.addEventListener("presence:update", handlePresenceUpdate);
    return () => window.removeEventListener("presence:update", handlePresenceUpdate);
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        setError(null);
        setResults(await request<Friend[]>(`/users/search?q=${encodeURIComponent(normalizedQuery)}`));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Unable to search users.");
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [query]);

  async function addFriend(friend: Friend) {
    try {
      setError(null);
      await request<Friend>(`/users/me/friends/${encodeURIComponent(friend.id)}`, {
        method: "POST",
      });
      setResults((currentResults) =>
        currentResults.map((result) =>
          result.id === friend.id ? { ...result, relationship: "PENDING_SENT" } : result,
        ),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to add friend.");
    }

  }

  async function respondToRequest(requester: Friend, action: "accept" | "decline") {
    try {
      setError(null);
      const path = `/users/me/friend-requests/${encodeURIComponent(requester.id)}/${action}`;
      const updatedFriend = await request<Friend>(path, {
        method: action === "accept" ? "PATCH" : "POST",
      });
      setRequests((currentRequests) =>
        currentRequests.filter((currentRequest) => currentRequest.id !== requester.id),
      );
      if (action === "accept") {
        setFriends((currentFriends) =>
          [...currentFriends, updatedFriend].sort((a, b) => a.username.localeCompare(b.username)),
        );
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to respond to friend request.");
    }
  }

  async function removeFriend(friend: Friend) {
    if (!window.confirm(`Remove ${friend.username} from your friends?`)) {
      return;
    }

    try {
      setError(null);
      await request<Friend>(`/users/me/friends/${encodeURIComponent(friend.id)}`, {
        method: "DELETE",
      });
      setFriends((currentFriends) =>
        currentFriends.filter((currentFriend) => currentFriend.id !== friend.id),
      );
      setResults((currentResults) =>
        currentResults.map((result) =>
          result.id === friend.id ? { ...result, relationship: "NONE" } : result,
        ),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to remove friend.");
    }
  }

  const friendIds = new Set(friends.map((friend) => friend.id));
  const visibleResults = query.trim().length >= 2 ? results : [];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      className="space-y-6"
    >
      <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }}>
        <h1 className="text-2xl font-semibold text-zinc-950">Friends</h1>
        <p className="text-sm text-zinc-500">People you&apos;ve played with.</p>
      </motion.div>

      <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }}>
        <label htmlFor="friend-search" className="sr-only">
          Search for friends
        </label>
        <input
          id="friend-search"
          type="search"
          placeholder="Add friends"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 sm:max-w-md"
        />
        {query.trim().length === 1 && (
          <p className="mt-2 text-xs text-zinc-500">Type at least 2 characters to search.</p>
        )}
        {visibleResults.length > 0 && (
          <div className="mt-2 w-full overflow-hidden rounded-md border border-zinc-200 bg-white sm:max-w-md">
            {visibleResults.map((result) => (
              <div key={result.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm text-zinc-950">{result.username}</span>
                <button
                  type="button"
                  disabled={friendIds.has(result.id) || result.relationship !== "NONE"}
                  onClick={() => void addFriend(result)}
                  className="rounded-md bg-violet-700 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {friendIds.has(result.id)
                    ? "Friends"
                    : result.relationship === "PENDING_SENT"
                      ? "Pending"
                      : result.relationship === "PENDING_RECEIVED"
                        ? "Respond"
                        : "Add"}
                </button>
              </div>
            ))}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </motion.div>

      {requests.length > 0 && (
        <motion.section variants={fadeUp} className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <h2 className="text-sm font-semibold text-violet-950">Friend requests</h2>
          <div className="mt-3 space-y-2">
            {requests.map((requestItem) => (
              <div key={requestItem.id} className="flex items-center justify-between gap-3 rounded-lg bg-white p-3">
                <span className="text-sm text-zinc-950">{requestItem.username} wants to be your friend</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void respondToRequest(requestItem, "accept")}
                    className="rounded-md bg-violet-700 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void respondToRequest(requestItem, "decline")}
                    className="rounded-md border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading friends...</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-zinc-500">You have not added any friends yet.</p>
        ) : friends.map((friend) => (
          <motion.div
            key={friend.id}
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-5"
          >
            <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">
              {friend.username.charAt(0)}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                  friend.status === "ONLINE" ? "bg-lime-400" : "bg-zinc-300"
                }`}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-950">{friend.username}</p>
              <p className="text-xs text-zinc-400">{friend.status === "ONLINE" ? "Online" : "Offline"}</p>
            </div>
            <button
              type="button"
              onClick={() => void removeFriend(friend)}
              className="ml-auto rounded-md border border-violet-200 px-2 py-1 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-50"
            >
              Remove
            </button>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
