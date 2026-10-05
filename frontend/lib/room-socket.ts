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

export function connectToRoom(
  roomId: string,
  onRoomState: (room: unknown) => void,
  onRoomStarted: (data: unknown) => void,
  onChatMessage?: (message: RoomMessage) => void,
): Socket | null {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    return null;
  }

  const socket = io(SOCKET_URL, {
    auth: {
      token,
    },
  });

  socket.on("connect", () => {
    socket.emit("room:join", { roomId });
  });

  socket.on("room:state", onRoomState);
  socket.on("room:started", onRoomStarted);
  if (onChatMessage) {
    socket.on("chat:message", onChatMessage);
  }

  socket.on("connect_error", (error) => {
    console.error("Room socket error:", error.message);
  });

  return socket;
}