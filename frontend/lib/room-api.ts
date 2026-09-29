const API_URL = "http://localhost:3001";

export type RoomPlayer = {
  id: string;
  username: string;
  avatarUrl: string;
};

export type Room = {
  id: string;
  status: string;
  minPlayers: number;
  maxPlayers: number;
  players: RoomPlayer[];
};

async function roomRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("accessToken");
  const headers = new Headers(options.headers);

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message ?? "Room request failed";
    throw new Error(message);
  }

  return data as T;
}

export async function createRoom(minPlayers: number, maxPlayers: number) {
  return roomRequest<Room>("/rooms", {
    method: "POST",
    body: JSON.stringify({ minPlayers, maxPlayers }),
  });
}

export function getRoom(roomId: string) {
  return roomRequest<Room>(`/rooms/${encodeURIComponent(roomId)}`);
}

export function joinRoom(roomId: string) {
  return roomRequest<Room>(`/rooms/${encodeURIComponent(roomId)}/join`, {
    method: "POST",
  });
}