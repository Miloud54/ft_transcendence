import { io, type Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:3001/games";

export type GameState = {
  gameId: string;
  status: "countdown" | "running" | "finished" | string;
  countdownRemaining: number;
  article?: {
    title: { tokens: unknown[] };
    paragraphs: { tokens: unknown[] }[];
  };
  scores: Record<string, number>;
  attempts: Record<string, number>;
};

export type GuessResult = {
  gameId: string;
  userId: string;
  guess: string;
  score: number;
  correct: boolean;
};

export function connectToGame(
  gameId: string,
  onState: (state: GameState) => void,
  onAuthError?: (message: string) => void,
  onGuessResult?: (result: GuessResult) => void,
): Socket | null {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    onAuthError?.("Your session has expired. Please log in again.");
    return null;
  }
  const socket = io(SOCKET_URL, { auth: { token }, reconnection: true });
  socket.on("connect", () => socket.emit("game:join", { gameId }));
  socket.on("game:state", onState);
  if (onGuessResult) {
    socket.on("game:guess-result", onGuessResult);
  }
  socket.on("auth:error", (error: { message?: string }) => {
    onAuthError?.(error.message ?? "Your session has expired. Please log in again.");
    socket.disconnect();
  });
  return socket;
}
