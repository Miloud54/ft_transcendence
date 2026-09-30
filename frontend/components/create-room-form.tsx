"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/room-api";

export function CreateRoomForm() {
  const router = useRouter();
  const [minPlayers, setMinPlayers] = useState(2);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const room = await createRoom(minPlayers, maxPlayers);
      router.push(`/lobby/${room.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create room");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-violet-200">
          Min players
          <input
            type="number"
            min={2}
            max={maxPlayers}
            value={minPlayers}
            onChange={(event) => setMinPlayers(Number(event.target.value))}
            className="mt-1 w-full rounded-md border border-transparent bg-white px-3 py-2 text-sm text-zinc-950 outline-none"
          />
        </label>
        <label className="text-xs text-violet-200">
          Max players
          <input
            type="number"
            min={minPlayers}
            max={6}
            value={maxPlayers}
            onChange={(event) => setMaxPlayers(Number(event.target.value))}
            className="mt-1 w-full rounded-md border border-transparent bg-white px-3 py-2 text-sm text-zinc-950 outline-none"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-200">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-lime-400 px-5 py-2.5 text-sm font-semibold text-violet-950 hover:bg-lime-300 disabled:opacity-60"
      >
        {isSubmitting ? "Creating room..." : "Create a game"}
      </button>
    </form>
  );
}
