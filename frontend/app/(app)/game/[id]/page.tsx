"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Socket } from "socket.io-client";
import { GameBoard } from "@/components/game-board";
import { getRoom, type Room } from "@/lib/room-api";
import { connectToGame, type GameState, type GuessResult } from "@/lib/game-socket";

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room");
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lastGuess, setLastGuess] = useState<GuessResult | null>(null);
  const [gameSocket, setGameSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!roomId) return;

    getRoom(roomId)
      .then(setRoom)
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : "Could not load players");
      });
  }, [roomId]);

  useEffect(() => {
    const socket = connectToGame(
      id,
      setGameState,
      setError,
      setLastGuess,
      setError,
      setGameSocket,
    );
    return () => {
      socket?.disconnect();
    };
  }, [id]);

  if (error) {
    return <p className="text-sm text-[#d03b3b]">{error}</p>;
  }

  return (
    <GameBoard
      gameId={id}
      players={room?.players ?? []}
      gameState={gameState}
      socket={gameSocket}
      lastGuess={lastGuess}
    />
  );
}
