import type { Metadata } from "next";
import Link from "next/link";
import { mockOpenRooms } from "@/lib/mock-data";
import { JoinRoomForm } from "@/components/join-room-form";

export const metadata: Metadata = {
  title: "Home",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">Home</h1>
        <p className="text-sm text-zinc-500">Create a game or join one to get started.</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-violet-800 bg-gradient-to-br from-violet-700 to-violet-900 p-6 text-white sm:p-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col justify-between rounded-xl bg-white/10 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">New game</p>
              <p className="mt-1 text-lg font-semibold">Create your own room</p>
              <p className="mt-1 text-sm text-violet-200">Choose the number of players and invite your friends.</p>
            </div>
            <Link
              href="/lobby/1"
              className="mt-4 inline-flex items-center justify-center rounded-md bg-lime-400 px-5 py-2.5 text-sm font-semibold text-violet-950 hover:bg-lime-300"
            >
              Create a game
            </Link>
          </div>

          <div className="flex flex-col justify-between rounded-xl bg-white/10 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">Join</p>
              <p className="mt-1 text-lg font-semibold">Got a room code?</p>
              <p className="mt-1 text-sm text-violet-200">Enter it to jump straight into the room.</p>
            </div>
            <div className="mt-4">
              <JoinRoomForm />
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-white/15 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">Open games</p>
          <div className="mt-3 space-y-2">
            {mockOpenRooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between rounded-lg bg-white/10 px-4 py-2.5"
              >
                <span className="text-sm">
                  <strong>{room.hostUsername}</strong>&apos;s room · {room.playerCount}/{room.maxPlayers} players
                </span>
                <Link
                  href={`/lobby/${room.id}`}
                  className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
                >
                  Join
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
