"use client";

import { motion } from "framer-motion";
import { mockLeaderboard } from "@/lib/mock-data";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export function LeaderboardContent() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      className="space-y-6"
    >
      <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }}>
        <h1 className="text-2xl font-semibold text-zinc-950">Leaderboard</h1>
        <p className="text-sm text-zinc-500">Top players on Transcendix.</p>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
        className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
      >
        {mockLeaderboard.map((entry) => (
          <motion.div
            key={entry.rank}
            variants={fadeUp}
            className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 last:border-0"
          >
            <div className="flex items-center gap-4">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  entry.rank === 1 ? "bg-lime-400 text-violet-950" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {entry.rank}
              </span>
              <div>
                <p className="text-sm font-medium text-zinc-950">{entry.username}</p>
                <p className="text-xs text-zinc-400">Level {entry.level}</p>
              </div>
            </div>
            <span className="text-sm font-semibold text-violet-700">{entry.wins} wins</span>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
