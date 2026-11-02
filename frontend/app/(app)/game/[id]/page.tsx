"use client";

import {  Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Socket } from "socket.io-client";
import { GameBoard } from "@/components/game-board";
import { GameNotFound } from "@/components/game-not-found";
import { getGameState, getRoom, type Room } from "@/lib/room-api";
import { connectToGame, type GameState, type GuessResult } from "@/lib/game-socket";

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <GameContent id={id} />
    </Suspense>
  );
}


function GameContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room");
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lastGuess, setLastGuess] = useState<GuessResult | null>(null);
  const [gameSocket, setGameSocket] = useState<Socket | null>(null);
  const [isLoadingGame, setIsLoadingGame] = useState(true);

  useEffect(() => {
    if (!/^\d+$/.test(id)) {
      return;
    }

    getGameState(id)
      .then(() => setIsLoadingGame(false))
      .catch(() => {
        setError("This game no longer exists or is unavailable.");
        setIsLoadingGame(false);
      });
  }, [id]);

  useEffect(() => {
    if (!roomId || !/^\d+$/.test(id) || !/^\d+$/.test(roomId)) return;

    getRoom(roomId)
      .then(setRoom)
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : "Could not load players");
      });
  }, [id, roomId]);

  useEffect(() => {
    if (!/^\d+$/.test(id) || isLoadingGame || error) {
      return;
    }

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
  }, [error, id, isLoadingGame]);

  if (error || !/^\d+$/.test(id)) {
    return <GameNotFound message={error ?? "The game ID is not valid."} />;
  }

  if (isLoadingGame) {
    return <p className="text-sm text-zinc-500">Loading game...</p>;
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
