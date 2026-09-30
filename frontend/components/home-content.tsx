"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { mockOpenRooms } from "@/lib/mock-data";
import { JoinRoomForm } from "@/components/join-room-form";
import { CreateRoomForm } from "@/components/create-room-form";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export function HomeContent() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
      className="space-y-6"
    >
      <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }}>
        <h1 className="text-2xl font-semibold text-zinc-950">Home</h1>
        <p className="text-sm text-zinc-500">Create a game or join one to get started.</p>
      </motion.div>

      <motion.section
        variants={fadeUp}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
        className="overflow-hidden rounded-2xl border border-violet-800 bg-gradient-to-br from-violet-700 to-violet-900 p-6 text-white sm:p-8"
      >
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } } }}
          className="grid gap-6 sm:grid-cols-2"
        >
          <motion.div variants={fadeUp} className="flex flex-col rounded-xl bg-white/10 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">New game</p>
              <p className="mt-1 text-lg font-semibold">Create your own room</p>
              <p className="mt-1 text-sm text-violet-200">Choose the number of players and invite your friends.</p>
            </div>

            <CreateRoomForm />
          </motion.div>

          <motion.div variants={fadeUp} className="flex flex-col rounded-xl bg-white/10 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">Join</p>
              <p className="mt-1 text-lg font-semibold">Got a room code?</p>
              <p className="mt-1 text-sm text-violet-200">Enter it to jump straight into the room.</p>
            </div>
            <div className="mt-4">
              <JoinRoomForm />
            </div>
          </motion.div>
        </motion.div>

        <div className="mt-6 border-t border-white/15 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">Open games</p>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } } }}
            className="mt-3 space-y-2"
          >
            {mockOpenRooms.map((room) => (
              <motion.div
                key={room.id}
                variants={fadeUp}
                whileHover={{ x: 4 }}
                className="flex items-center justify-between rounded-lg bg-white/10 px-4 py-2.5"
              >
                <span className="text-sm">
                  <strong>{room.hostUsername}</strong>&apos;s room · {room.playerCount}/{room.maxPlayers} players
                </span>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    href={`/lobby/${room.id}`}
                    className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
                  >
                    Join
                  </Link>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>
    </motion.div>
  );
}
