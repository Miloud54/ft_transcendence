import type { Metadata } from "next";
import { GameBoard } from "@/components/game-board";

export const metadata: Metadata = {
  title: "Game",
};

export default function GamePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  return <GameBoard gameId={id} />;
}
