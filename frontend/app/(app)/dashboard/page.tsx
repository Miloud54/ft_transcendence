import type { Metadata } from "next";
import Link from "next/link";
import { mockStats, mockOpenRooms } from "@/lib/mock-data";
import { StatTile } from "@/components/stat-tile";
import { LineChart } from "@/components/charts/line-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { CreateRoomForm } from "@/components/create-room-form";
import { JoinRoomForm } from "@/components/join-room-form";

export const metadata: Metadata = {
  title: "Dashboard",
};

const TEMPERATURE_BANDS = [
  { label: "Cold", value: mockStats.averageScoreByDifficulty[0].value, color: "#2a78d6" },
  { label: "Warm", value: mockStats.averageScoreByDifficulty[1].value, color: "#a1a1aa" },
  { label: "Hot", value: mockStats.averageScoreByDifficulty[2].value, color: "#e34948" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">My dashboard</h1>
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

      <CreateRoomForm />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label="Games played" value={mockStats.gamesPlayed} trend={mockStats.gamesPlayedTrend} />
        <StatTile label="Wins" value={mockStats.wins} trend={mockStats.winsTrend} />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-medium text-zinc-700">Average attempt temperature</h2>
        <div className="mt-4 space-y-3">
          {TEMPERATURE_BANDS.map((band) => (
            <div key={band.label} className="flex items-center gap-3">
              <span className="w-12 text-xs text-zinc-500">{band.label}</span>
              <div className="h-2 flex-1 rounded-full bg-zinc-100">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${band.value * 100}%`, backgroundColor: band.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-medium text-zinc-700">Progression dans le temps</h2>
          <p className="text-xs text-zinc-400">Parties jouées par mois</p>
          <div className="mt-4">
            <LineChart data={mockStats.progression} />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-medium text-zinc-700">Répartition</h2>
          <div className="mt-4">
            <DonutChart
              data={[
                { label: "Victoires", value: mockStats.distribution.wins, color: "#65a30d" },
                { label: "Défaites", value: mockStats.distribution.losses, color: "#6d28d9" },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
