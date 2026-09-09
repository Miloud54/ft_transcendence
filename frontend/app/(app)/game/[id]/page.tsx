import type { Metadata } from "next";
import { GameBoard } from "@/components/game-board";

export const metadata: Metadata = {
  title: "Partie",
};

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <GameBoard gameId={id} />;
}
