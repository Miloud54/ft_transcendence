"use client";

import { motion } from "framer-motion";
import { mockFriends } from "@/lib/mock-data";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export function FriendsContent() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      className="space-y-6"
    >
      <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }}>
        <h1 className="text-2xl font-semibold text-zinc-950">Friends</h1>
        <p className="text-sm text-zinc-500">People you've played with.</p>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {mockFriends.map((friend) => (
          <motion.div
            key={friend.id}
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-5"
          >
            <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">
              {friend.username.charAt(0)}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                  friend.status === "online" ? "bg-lime-400" : "bg-zinc-300"
                }`}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-950">{friend.username}</p>
              <p className="text-xs text-zinc-400">{friend.status === "online" ? "Online" : "Offline"}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
