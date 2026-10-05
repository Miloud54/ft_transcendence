import { io, type Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:3001/rooms";

export type RoomMessage = {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatar: string;
  text: string;
  createdAt: string;
};

export type RoomSocketStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

type RoomSocketOptions = {
  onChatMessage?: (message: RoomMessage) => void;
  onStatus?: (status: RoomSocketStatus, message?: string) => void;
  onAuthError?: (message: string) => void;
};

export function connectToRoom(
  roomId: string,
  onRoomState: (room: unknown) => void,
  onRoomStarted: (data: unknown) => void,
  options: RoomSocketOptions = {},
): Socket | null {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    options.onAuthError?.("Your session has expired. Please log in again.");
    return null;
  }

  options.onStatus?.("connecting");

  const socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    reconnection: true,
  });

  socket.on("connect", () => {
    options.onStatus?.("connected");
    socket.emit("room:join", { roomId });
  });

  socket.on("room:state", onRoomState);
  socket.on("room:started", onRoomStarted);
  if (options.onChatMessage) {
    socket.on("chat:message", options.onChatMessage);
  }

  socket.on("auth:error", (error: { message?: string }) => {
    options.onStatus?.("error", error.message);
    options.onAuthError?.(
      error.message ?? "Your session has expired. Please log in again.",
    );
    socket.disconnect();
  });

  socket.io.on("reconnect_attempt", () => {
    options.onStatus?.("reconnecting");
  });

  socket.io.on("reconnect", () => {
    options.onStatus?.("connected");
  });

  socket.io.on("reconnect_error", (error) => {
    options.onStatus?.("error", error.message);
  });

  socket.on("connect_error", (error) => {
    options.onStatus?.("error", error.message);
    if (/unauthorized|expired|token|authentication/i.test(error.message)) {
      options.onAuthError?.(
        "Your session has expired. Please log in again.",
      );
      socket.disconnect();
    }
  });

  socket.on("disconnect", (reason) => {
    options.onStatus?.("disconnected", reason);
  });

  return socket;
}