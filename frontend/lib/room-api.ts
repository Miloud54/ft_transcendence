export const API_URL = "/api";

export type RoomPlayer = {
  id: string;
  username: string;
  avatarUrl: string;
};

export type Room = {
  id: string;
  hostId: string;
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

export function inviteFriendToRoom(roomId: string, friendId: string) {
  return roomRequest<RoomInvitation>(
    `/rooms/${encodeURIComponent(roomId)}/invite/${encodeURIComponent(friendId)}`,
    { method: "POST" },
  );
}

export type RoomInvitation = {
  roomId: string;
  friendId: string;
  inviter: {
    id: string;
    username: string;
  };
};

export function getRoomInvitations() {
  return roomRequest<RoomInvitation[]>("/rooms/me/invitations");
}

export type FriendRequest = Friend & {
  relationship?: "PENDING_RECEIVED";
};

export function getFriendRequests() {
  return roomRequest<FriendRequest[]>("/users/me/friend-requests");
}

export function acceptFriendRequest(requesterId: string) {
  return roomRequest<Friend>(`/users/me/friend-requests/${encodeURIComponent(requesterId)}/accept`, {
    method: "PATCH",
  });
}

export function declineFriendRequest(requesterId: string) {
  return roomRequest<{ message: string }>(
    `/users/me/friend-requests/${encodeURIComponent(requesterId)}/decline`,
    { method: "POST" },
  );
}

export function acceptRoomInvitation(roomId: string) {
  return roomRequest<Room>(`/rooms/${encodeURIComponent(roomId)}/invitation/accept`, {
    method: "POST",
  });
}

export function declineRoomInvitation(roomId: string) {
  return roomRequest<{ roomId: string; declined: boolean }>(
    `/rooms/${encodeURIComponent(roomId)}/invitation/decline`,
    { method: "POST" },
  );
}

export type Friend = {
  id: string;
  username: string;
  avatar: string;
  status: "ONLINE" | "OFFLINE";
};

export function getFriends() {
  return roomRequest<Friend[]>("/users/me/friends");
}

export type StartRoomResponse = {
  room: {
    id: string;
    status: string;
  };
  game: {
    id: string;
    status: string;
  };
};

export function startRoom(roomId: string) {
  return roomRequest<StartRoomResponse>(
    `/rooms/${encodeURIComponent(roomId)}/start`,
    { method: "POST" },
  );
}