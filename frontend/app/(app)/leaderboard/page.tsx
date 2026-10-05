import type { Metadata } from "next";
import { LeaderboardContent } from "@/components/leaderboard-content";

export const metadata: Metadata = {
  title: "Leaderboard",
};

export default function LeaderboardPage() {
  return <LeaderboardContent />;
}
