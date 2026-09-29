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
    <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-medium text-zinc-700">Create a room</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-zinc-700">
          Minimum players
          <input
            type="number"
            min={2}
            max={maxPlayers}
            value={minPlayers}
            onChange={(event) => setMinPlayers(Number(event.target.value))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="text-sm text-zinc-700">
          Maximum players
          <input
            type="number"
            min={minPlayers}
            max={6}
            value={maxPlayers}
            onChange={(event) => setMaxPlayers(Number(event.target.value))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-[#d03b3b]">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 rounded-md bg-violet-700 px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSubmitting ? "Creating room..." : "Create room"}
      </button>
    </form>
  );
}