import { io, type Socket } from "socket.io-client";

function getSocketOrigin() {
  return window.location.port === "3000"
    ? "http://localhost:3001"
    : window.location.origin;
}


export type GameState = {
  gameId: string;
  status: "countdown" | "running" | "finished" | string;
  countdownRemaining: number;
  article?: {
    title: { tokens: ArticleToken[] };
    paragraphs: { tokens: ArticleToken[] }[];
  };
  scores: Record<string, number>;
  attempts: Record<string, number>;
  winnerId?: string;
};

export type ArticleToken =
  // grade: 1..4 when a hidden word is semantically close to a past guess
  | { type: "word"; status: "hidden"; length: number; grade?: number }
  | { type: "word"; status: "revealed"; length: number; display: string }
  | { type: "separator"; display: string };

export type GuessRejection =
  | "EMPTY"
  | "TOO_LONG"
  | "SINGLE_WORD_ONLY"
  | "NOT_A_WORD"
  | "ALREADY_GUESSED"
  | "GAME_FINISHED"
  | "TOO_FAST";

export type GuessResult = {
  gameId: string;
  userId: string;
  guess: string;
  valid: boolean;
  reason?: GuessRejection;
  /** points earned by this guess */
  score: number;
  /** true when this guess completed the title */
  correct: boolean;
  revealedCount: number;
  /** 0 = nothing close, 1..4 = how close the closest hidden word is */
  bestGrade: number;
};

export function connectToGame(
  gameId: string,
  onState: (state: GameState) => void,
  onAuthError?: (message: string) => void,
  onGuessResult?: (result: GuessResult) => void,
  onError?: (message: string) => void,
  onConnected?: (socket: Socket) => void,
): Socket | null {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    onAuthError?.("Your session has expired. Please log in again.");
    return null;
  }
  const socket = io(`${getSocketOrigin()}/games`, { auth: { token }, reconnection: true });
  socket.on("connect", () => socket.emit("game:join", { gameId }));
  socket.on("connect", () => onConnected?.(socket));
  socket.on("game:state", onState);
  if (onGuessResult) {
    socket.on("game:guess-result", onGuessResult);
  }
  socket.on("auth:error", (error: { message?: string }) => {
    onAuthError?.(error.message ?? "Your session has expired. Please log in again.");
    socket.disconnect();
  });
  socket.on("connect_error", (error) => onError?.(error.message));
  socket.io.on("reconnect_attempt", () => {
    const latestToken = localStorage.getItem("accessToken");
    if (latestToken) {
      socket.auth = { token: latestToken };
    }
  });
  socket.io.on("reconnect_error", (error) => onError?.(error.message));
  socket.on("disconnect", (reason) => {
    if (reason !== "io client disconnect") {
      onError?.(`Game connection closed: ${reason}`);
    }
  });
  const handleSocketError = (error: { message?: string } | string) => {
    const message = typeof error === "string" ? error : error.message;
    onError?.(message ?? "Game request failed");
  };
  socket.on("game:error", handleSocketError);
  socket.on("exception", handleSocketError);
  return socket;
}