"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL, createRematchRoom } from "@/lib/room-api";
import { useCurrentUser } from "@/lib/current-user-context";

type ResultPlayer = {
  userId: string;
  username: string;
  avatar: string;
  result: "WIN" | "LOSS" | null;
  score: number | null;
  rank: number | null;
  discoveryRank: number | null;
  xpGained: number;
  leveledUp: boolean;
};

type GameResults = {
  gameId: string;
  articleTitle: string | null;
  byScore: ResultPlayer[];
  byDiscovery: ResultPlayer[];
};

function PodiumSpot({
  entry,
  place,
  metric,
}: {
  entry: ResultPlayer;
  place: 1 | 2 | 3;
  metric: string;
}) {
  const barHeight = place === 1 ? "h-24" : place === 2 ? "h-16" : "h-12";
  const barColor = place === 1 ? "bg-lime-300" : place === 2 ? "bg-violet-100" : "bg-zinc-100";
  const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
  const avatarSize = place === 1 ? "h-12 w-12" : "h-10 w-10";

  return (
    <div className="flex flex-col items-center">
      <img src={entry.avatar} alt="" className={`${avatarSize} rounded-full bg-zinc-100 object-cover`} />
      <p className="mt-1 max-w-[80px] truncate text-xs font-semibold text-zinc-950">{entry.username}</p>
      <p className="text-[11px] text-zinc-400">{metric}</p>
      <div className={`mt-2 flex ${barHeight} w-16 items-start justify-center rounded-t-lg ${barColor} pt-1 text-lg`}>
        {medal}
      </div>
    </div>
  );
}

function RankingCard({
  title,
  entries,
  metric,
}: {
  title: string;
  entries: ResultPlayer[];
  metric: (entry: ResultPlayer) => string;
  rankOf?: (entry: ResultPlayer) => number | null;
}) {
  const [first, second, third, ...rest] = entries;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <p className="border-b border-zinc-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-violet-600">
        {title}
      </p>

      {(first || second || third) && (
        <div className="flex items-end justify-center gap-3 border-b border-zinc-100 px-4 py-6">
          {second && <PodiumSpot entry={second} place={2} metric={metric(second)} />}
          {first && <PodiumSpot entry={first} place={1} metric={metric(first)} />}
          {third && <PodiumSpot entry={third} place={3} metric={metric(third)} />}
        </div>
      )}

      {rest.map((entry, index) => (
        <div key={entry.userId} className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 last:border-b-0">
          <span className="flex items-center gap-2 text-sm font-medium text-zinc-950">
            <img src={entry.avatar} alt="" className="h-6 w-6 rounded-full bg-zinc-100" />
            {index + 4}. {entry.username}
          </span>
          <span className="text-sm tabular-nums text-zinc-500">{metric(entry)}</span>
        </div>
      ))}
    </div>
  );
}

export function ResultsContent({ gameId }: { gameId: string }) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [results, setResults] = useState<GameResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingRematch, setIsCreatingRematch] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    fetch(`${API_URL}/game/${gameId}/results`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load the results.");
        return response.json();
      })
      .then(setResults)
      .catch((err: Error) => setError(err.message));
  }, [gameId]);

  if (error) {
    return <p className="text-sm text-[#d03b3b]">{error}</p>;
  }

  if (!results) {
    return <p className="text-sm text-zinc-500">Loading results...</p>;
  }

  const winner = results.byDiscovery[0];
  const you = results.byScore.find((player) => player.userId === user?.id);

  async function handlePlayAgain() {
    if (!results) return;
    setIsCreatingRematch(true);
    setError(null);
    try {
      const playerIds = results.byScore.map((player) => player.userId);
      const room = await createRematchRoom(2, Math.max(results.byScore.length, 2), playerIds);
      router.push(`/lobby/${room.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create a new room");
      setIsCreatingRematch(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 text-center">
      <div>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-lime-100 text-2xl">
          🏆
        </div>
        <h1 className="mt-4 text-xl font-semibold text-zinc-950">
          {winner ? `${winner.username} wins the game` : "Game results"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Article to guess: {results.articleTitle ?? "Unknown"} · Game #{results.gameId}
        </p>
      </div>

      {you && (
        <div
          role="status"
          className="mx-auto flex w-fit flex-wrap items-center justify-center gap-2 rounded-full bg-violet-700 px-5 py-2 text-sm font-semibold text-white"
        >
          <span>+{you.xpGained} XP</span>
          {you.leveledUp && (
            <span className="rounded-full bg-lime-400 px-2.5 py-0.5 text-xs font-bold text-violet-950">
              Level up!
            </span>
          )}
          {you.xpGained === 0 && (
            <span className="text-xs font-normal text-violet-200">No XP for leaving or scoring 0</span>
          )}
        </div>
      )}

      <div className="grid gap-6 text-left sm:grid-cols-2">
        <RankingCard
          title="By page discovery order"
          entries={results.byDiscovery}
          metric={(entry) => (entry.discoveryRank === 1 ? "First to find it" : entry.discoveryRank ? `#${entry.discoveryRank}` : "—")}
        />

        <RankingCard
          title="By points"
          entries={results.byScore}
          metric={(entry) => `${entry.score ?? "—"} pts · +${entry.xpGained} XP`}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/home" className="rounded-md border border-zinc-300 px-6 py-2.5 text-sm font-medium text-zinc-700">
          Home
        </Link>
        <button
          type="button"
          onClick={() => void handlePlayAgain()}
          disabled={isCreatingRematch}
          className="rounded-md bg-lime-400 px-6 py-2.5 text-center text-sm font-semibold text-violet-900 disabled:opacity-60"
        >
          {isCreatingRematch ? "Creating room..." : "Play again"}
        </button>
      </div>
    </div>
  );
}
