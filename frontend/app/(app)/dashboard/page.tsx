"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { mockStats } from "@/lib/mock-data";
import { StatTile } from "@/components/stat-tile";
import { LineChart } from "@/components/charts/line-chart";
import { DonutChart } from "@/components/charts/donut-chart";

type Profile = {
  id: string;
  username: string;
  email: string;
  avatar: string;
  xp: number;
  lvl: number;
  status: string;
};

const TEMPERATURE_BANDS = [
  { label: "Cold", value: mockStats.averageScoreByDifficulty[0].value, color: "#c8ff16" },
  { label: "Warm", value: mockStats.averageScoreByDifficulty[1].value, color: "linear-gradient(to right, #c8ff16, #5941ff)" },
  { label: "Hot", value: mockStats.averageScoreByDifficulty[2].value, color: "#5941ff" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");

    fetch("http://localhost:3001/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load your profile.");
        return response.json();
      })
      .then(setProfile)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return <p className="text-sm text-[#d03b3b]">{error}</p>;
  }

  if (!profile) {
    return <p className="text-sm text-zinc-500">Loading your dashboard...</p>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="space-y-6"
    >
      <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }}>
        <h1 className="text-2xl font-semibold text-zinc-950">Dashboard</h1>
        <p className="text-sm text-zinc-500">Your profile and stats on Transcendix.</p>
      </motion.div>

      <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }} className="grid gap-4 lg:grid-cols-3">
        <motion.div
          whileHover={{ y: -4 }}
          className="rounded-xl border border-zinc-200 border-t-4 bg-white p-6"
          style={{ borderTopColor: "#5941ff" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Profile</p>
          <div className="mt-3 flex items-center gap-4">
            <img
              src={profile.avatar}
              alt={profile.username}
              className="h-16 w-16 rounded-full bg-zinc-100"
            />
            <div>
              <p className="text-lg font-semibold text-zinc-950">{profile.username}</p>
              <p className="text-sm text-zinc-500">{profile.email}</p>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-zinc-400">Level</dt>
              <dd className="font-medium text-zinc-950">{profile.lvl}</dd>
            </div>
            <div>
              <dt className="text-zinc-400">XP</dt>
              <dd className="font-medium text-zinc-950">{profile.xp}</dd>
            </div>
            <div>
              <dt className="text-zinc-400">Status</dt>
              <dd className="font-medium text-zinc-950">{profile.status}</dd>
            </div>
          </dl>
        </motion.div>

        <StatTile label="Games played" value={mockStats.gamesPlayed} trend={mockStats.gamesPlayedTrend} />
        <StatTile label="Wins" value={mockStats.wins} trend={mockStats.winsTrend} accent="#c8ff16" />
      </motion.div>

      <motion.div
        variants={fadeUp}
        transition={{ duration: 0.4, ease: "easeOut" }}
        whileHover={{ y: -4 }}
        className="rounded-xl border border-zinc-200 border-t-4 bg-white p-6"
        style={{ borderTopColor: "#5941ff" }}
      >
        <h2 className="text-sm font-medium text-zinc-700">Average attempt temperature</h2>
        <div className="mt-4 space-y-3">
          {TEMPERATURE_BANDS.map((band) => (
            <div key={band.label} className="flex items-center gap-3">
              <span className="w-12 text-xs text-zinc-500">{band.label}</span>
              <div className="h-2 flex-1 rounded-full bg-zinc-100">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${band.value * 100}%`, background: band.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }} className="grid gap-4 lg:grid-cols-2">
        <motion.div
          whileHover={{ y: -4 }}
          className="rounded-xl border border-zinc-200 border-t-4 bg-white p-6"
          style={{ borderTopColor: "#5941ff" }}
        >
          <h2 className="text-sm font-medium text-zinc-700">Progression over time</h2>
          <p className="text-xs text-zinc-400">Games played per month</p>
          <div className="mt-4">
            <LineChart data={mockStats.progression} />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="rounded-xl border border-zinc-200 border-t-4 bg-white p-6"
          style={{ borderTopColor: "#c8ff16" }}
        >
          <h2 className="text-sm font-medium text-zinc-700">Breakdown</h2>
          <div className="mt-4">
            <DonutChart
              data={[
                { label: "Wins", value: mockStats.distribution.wins, color: "#c8ff16" },
                { label: "Losses", value: mockStats.distribution.losses, color: "#5941ff" },
              ]}
            />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
