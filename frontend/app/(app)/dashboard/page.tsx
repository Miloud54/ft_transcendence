import type { Metadata } from "next";
import { mockStats } from "@/lib/mock-data";
import { StatTile } from "@/components/stat-tile";
import { LineChart } from "@/components/charts/line-chart";
import { DonutChart } from "@/components/charts/donut-chart";

export const metadata: Metadata = {
  title: "Dashboard",
};

const TEMPERATURE_BANDS = [
  { label: "Froid", value: mockStats.averageScoreByDifficulty[0].value, color: "#2a78d6" },
  { label: "Tiède", value: mockStats.averageScoreByDifficulty[1].value, color: "#a1a1aa" },
  { label: "Chaud", value: mockStats.averageScoreByDifficulty[2].value, color: "#e34948" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-950">Mon dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label="Parties jouées" value={mockStats.gamesPlayed} trend={mockStats.gamesPlayedTrend} />
        <StatTile label="Victoires" value={mockStats.wins} trend={mockStats.winsTrend} />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-medium text-zinc-700">Température moyenne des tentatives</h2>
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