import type { Metadata } from "next";
import Link from "next/link";
import { mockResults, mockWinnerArticleTitle } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Résultats",
};

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const winner = mockResults[0];

  return (
    <div className="mx-auto max-w-xl space-y-6 text-center">
      <div>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-lime-100 text-2xl">
          🏆
        </div>
        <h1 className="mt-4 text-xl font-semibold text-zinc-950">
          {winner.username} remporte la partie
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Article à deviner : {mockWinnerArticleTitle} · Partie #{id}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white text-left">
        {mockResults.map((entry) => (
          <div
            key={entry.rank}
            className="flex items-center justify-between border-b border-zinc-100 px-6 py-3 last:border-b-0"
          >
            <span className="text-sm font-medium text-zinc-950">
              {entry.rank}. {entry.username}
            </span>
            <span className="text-sm tabular-nums text-zinc-500">{entry.time}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/dashboard"
          className="rounded-md border border-zinc-300 px-6 py-2.5 text-sm font-medium text-zinc-700"
        >
          Dashboard
        </Link>
        <button className="rounded-md bg-lime-400 px-6 py-2.5 text-sm font-semibold text-violet-900">
          Rejouer
        </button>
      </div>
    </div>
  );
}