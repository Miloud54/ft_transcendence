"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { API_URL } from "@/lib/room-api";

type Match = {
  id: string;
  articleTitle: string | null;
  result: "win" | "loss";
  score: number | null;
  rank: number | null;
  playedAt: string | null;
  opponents: string[];
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export function GamesContent() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");

    fetch(`${API_URL}/users/me/matches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load your match history.");
        return response.json();
      })
      .then(setMatches)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  if (error) {
    return <p className="text-sm text-[#d03b3b]">{error}</p>;
  }

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Loading your match history...</p>;
  }

  if (matches.length === 0) {
    return <p className="text-sm text-zinc-500">You haven&apos;t played any games yet.</p>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      className="space-y-6"
    >
      <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }}>
        <h1 className="text-2xl font-semibold text-zinc-950">My games</h1>
        <p className="text-sm text-zinc-500">Your match history on Transcendix.</p>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
        className="space-y-3"
      >
        {matches.map((match) => (
          <motion.div
            key={match.id}
            variants={fadeUp}
            whileHover={{ y: -2 }}
            className="flex items-center justify-between rounded-xl border border-zinc-200 border-t-4 bg-white p-5"
            style={{ borderTopColor: match.result === "win" ? "#c8ff16" : "#4d37fb" }}
          >
            <div>
              <p className="font-semibold text-zinc-950">{match.articleTitle ?? "Untitled article"}</p>
              <p className="mt-1 text-sm text-zinc-500">
                vs {match.opponents.length > 0 ? match.opponents.join(", ") : "no opponents"} ·{" "}
                {match.playedAt ? new Date(match.playedAt).toLocaleDateString() : "unknown date"}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                match.result === "win" ? "bg-lime-100 text-lime-800" : "bg-violet-100 text-violet-700"
              }`}
            >
              {match.result === "win" ? "Victory" : "Defeat"}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
