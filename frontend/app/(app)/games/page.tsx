import type { Metadata } from "next";
import { GamesContent } from "@/components/games-content";

export const metadata: Metadata = {
  title: "My games",
};

export default function GamesPage() {
  return <GamesContent />;
}
