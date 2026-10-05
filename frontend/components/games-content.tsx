"use client";

import { motion } from "framer-motion";
import { mockMatchHistory } from "@/lib/mock-data";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export function GamesContent() {
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
        {mockMatchHistory.map((match) => (
          <motion.div
            key={match.id}
            variants={fadeUp}
            whileHover={{ y: -2 }}
            className="flex items-center justify-between rounded-xl border border-zinc-200 border-t-4 bg-white p-5"
            style={{ borderTopColor: match.result === "win" ? "#c8ff16" : "#4d37fb" }}
          >
            <div>
              <p className="font-semibold text-zinc-950">{match.articleTitle}</p>
              <p className="mt-1 text-sm text-zinc-500">
                vs {match.opponents.join(", ")} · {match.playedAt}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                match.result === "win"
                  ? "bg-lime-100 text-lime-800"
                  : "bg-violet-100 text-violet-700"
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
