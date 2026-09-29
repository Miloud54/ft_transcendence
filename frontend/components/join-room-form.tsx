"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { joinRoom } from "@/lib/room-api";

export function JoinRoomForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const roomId = code.trim();

    if (!roomId) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const room = await joinRoom(roomId);
      router.push(`/lobby/${room.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not join room");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Room code"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-white px-3 py-2 text-sm text-zinc-950 outline-none placeholder:text-zinc-400"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-lime-400 px-4 py-2 text-sm font-semibold text-violet-950 hover:bg-lime-300 disabled:opacity-60"
        >
          {isSubmitting ? "Joining..." : "Join"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-200">{error}</p>}
    </form>
  );
}
