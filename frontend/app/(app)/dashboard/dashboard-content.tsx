"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { StatTile } from "@/components/stat-tile";
import { LineChart } from "@/components/charts/line-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { API_URL } from "@/lib/room-api";
import { useCurrentUser } from "@/lib/current-user-context";

type Achievement = {
  id: string;
  label: string;
  description: string;
  earned: boolean;
};

type Stats = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  averageScore: number;
  bestRank: number | null;
  level: number;
  xp: number;
  achievements: Achievement[];
};

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

export function DashboardContent() {
  const searchParams = useSearchParams();
  const profileId = searchParams.get("user");
  const { user: currentUser, isLoading: isLoadingProfile, setUser } = useCurrentUser();
  const [loadedProfile, setLoadedProfile] = useState<typeof currentUser>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isOwnProfile = !profileId || profileId === currentUser?.id;
  const profile = isOwnProfile ? currentUser : loadedProfile;

  async function handleStatusChange(status: "ONLINE" | "OFFLINE") {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`${API_URL}/users/me/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data);
      }
    } catch {
      // non-critical: ignore network errors here
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API_URL}/users/${encodeURIComponent(profileId ?? "me")}/stats`, { headers }).then((r) => {
        if (!r.ok) throw new Error("Could not load this profile's stats.");
        return r.json();
      }),
      fetch(`${API_URL}/users/${encodeURIComponent(profileId ?? "me")}/matches`, { headers }).then((r) => {
        if (!r.ok) throw new Error("Could not load this profile's match history.");
        return r.json();
      }),
    ])
      .then(([statsData, matchesData]) => {
        setStats(statsData);
        setMatches(matchesData);
      })
      .catch((err: Error) => setError(err.message));
    if (profileId && profileId !== currentUser?.id) {
      fetch(`${API_URL}/users/${encodeURIComponent(profileId)}`, { headers })
        .then((r) => {
          if (!r.ok) throw new Error("Could not load this profile.");
          return r.json();
        })
        .then(setLoadedProfile)
        .catch((err: Error) => setError(err.message));
    } else {
    }
  }, [currentUser, profileId]);

  if (error) {
    return <p className="text-sm text-[#d03b3b]">{error}</p>;
  }

  if (isLoadingProfile || !profile || !stats) {
    return <p className="text-sm text-zinc-500">Loading dashboard...</p>;
  }

  const scoreProgression = [...matches].reverse().map((match) => match.score ?? 0);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="space-y-6"
    >
      <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }}>
        <h1 className="text-2xl font-semibold text-zinc-950">
          {isOwnProfile ? "Dashboard" : `${profile.username}'s dashboard`}
        </h1>
        <p className="text-sm text-zinc-500">
          {isOwnProfile ? "Your profile and stats on Transcendix." : "Profile and stats on Transcendix."}
        </p>
      </motion.div>

      <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }} className="grid gap-4 lg:grid-cols-3">
        <motion.div
          whileHover={{ y: -4 }}
          className="rounded-xl border border-zinc-200 border-t-4 bg-white p-6"
          style={{ borderTopColor: "#4d37fb" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Profile</p>
          <div className="mt-3 flex items-center gap-4">
            <img src={profile.avatar} alt={profile.username} className="h-16 w-16 rounded-full bg-zinc-100" />
            <div>
              <p className="text-lg font-semibold text-zinc-950">{profile.username}</p>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-zinc-400">Status</dt>
              <dd>
                {profile.status === "IN_GAME" ? (
                  <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                    In game
                  </span>
                ) : isOwnProfile ? (
                  <button
                    type="button"
                    onClick={() => void handleStatusChange(profile.status === "ONLINE" ? "OFFLINE" : "ONLINE")}
                    className={`mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      profile.status === "ONLINE"
                        ? "bg-lime-100 text-lime-800 hover:bg-lime-200"
                        : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${profile.status === "ONLINE" ? "bg-lime-500" : "bg-zinc-400"}`} />
                    {profile.status === "ONLINE" ? "Online" : "Offline"}
                  </button>
                ) : (
                  <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                    <span className={`h-1.5 w-1.5 rounded-full ${profile.status === "ONLINE" ? "bg-lime-500" : "bg-zinc-400"}`} />
                    {profile.status === "ONLINE" ? "Online" : "Offline"}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </motion.div>

        <StatTile label="Games played" value={stats.gamesPlayed} />
        <StatTile label="Wins" value={stats.wins} trend={`${stats.winRate}% win rate`} accent="#c8ff16" />
      </motion.div>

      <motion.div
        variants={fadeUp}
        transition={{ duration: 0.4, ease: "easeOut" }}
        whileHover={{ y: -4 }}
        className="rounded-xl border border-zinc-200 border-t-4 bg-white p-6"
        style={{ borderTopColor: "#4d37fb" }}
      >
        <h2 className="text-sm font-medium text-zinc-700">Achievements</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {stats.achievements.map((achievement) => (
            <div
              key={achievement.id}
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                achievement.earned ? "border-lime-200 bg-lime-50" : "border-zinc-200 bg-zinc-50 opacity-60"
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  achievement.earned ? "bg-lime-400 text-violet-950" : "bg-zinc-200 text-zinc-500"
                }`}
              >
                {achievement.earned ? "✓" : "–"}
              </span>
              <div>
                <p className="text-sm font-medium text-zinc-950">{achievement.label}</p>
                <p className="text-xs text-zinc-500">{achievement.description}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }} className="grid gap-4 lg:grid-cols-2">
        <motion.div
          whileHover={{ y: -4 }}
          className="rounded-xl border border-zinc-200 border-t-4 bg-white p-6"
          style={{ borderTopColor: "#4d37fb" }}
        >
          <h2 className="text-sm font-medium text-zinc-700">Score progression</h2>
          <p className="text-xs text-zinc-400">Your score across your last matches (oldest to newest)</p>
          <div className="mt-4">
            {scoreProgression.length > 1 ? (
              <LineChart data={scoreProgression} />
            ) : (
              <p className="text-sm text-zinc-400">Play more games to see your progression.</p>
            )}
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
                { label: "Wins", value: stats.wins, color: "#c8ff16" },
                { label: "Losses", value: stats.losses, color: "#4d37fb" },
              ]}
            />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
