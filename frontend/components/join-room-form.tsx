"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function JoinRoomForm() {
  const [code, setCode] = useState("");
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.trim()) {
      router.push(`/lobby/${code.trim()}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Room code"
        className="min-w-0 flex-1 rounded-md border border-transparent bg-white px-3 py-2 text-sm text-zinc-950 outline-none placeholder:text-zinc-400"
      />
      <button
        type="submit"
        className="rounded-md bg-lime-400 px-4 py-2 text-sm font-semibold text-violet-950 hover:bg-lime-300"
      >
        Join
      </button>
    </form>
  );
}
