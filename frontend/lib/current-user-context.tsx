"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io } from "socket.io-client";
import { API_URL } from "@/lib/room-api";

export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  avatar: string;
  xp: number;
  lvl: number;
  status: string;
};

type CurrentUserContextValue = {
  user: CurrentUser | null;
  isLoading: boolean;
  setUser: (user: CurrentUser | null) => void;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
    const token = localStorage.getItem("accessToken");

    fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load current user.");
        return response.json();
      })
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));

    if (token) {
      const socketOrigin =
        window.location.port === "3000"
          ? "http://localhost:3001"
          : window.location.origin;
      const presenceSocket = io(`${socketOrigin}/presence`, {
        auth: { token },
        reconnection: true,
      });

      presenceSocket.on("presence:update", (update: { id: string; status: string }) => {
        window.dispatchEvent(new CustomEvent("presence:update", { detail: update }));
      });
      presenceSocket.on("friend-request:received", (requester: unknown) => {
        window.dispatchEvent(new CustomEvent("friend-request:received", { detail: requester }));
      });
      presenceSocket.on("friend-request:accepted", (friend: unknown) => {
        window.dispatchEvent(new CustomEvent("friend-request:accepted", { detail: friend }));
      });
      presenceSocket.on("friend-request:declined", (request: unknown) => {
        window.dispatchEvent(new CustomEvent("friend-request:declined", { detail: request }));
      });
      presenceSocket.on("friend:removed", (friend: unknown) => {
        window.dispatchEvent(new CustomEvent("friend:removed", { detail: friend }));
      });
      presenceSocket.on("room-invitation:received", (invitation: unknown) => {
        window.dispatchEvent(new CustomEvent("room-invitation:received", { detail: invitation }));
      });

      const updatePresence = () =>
        fetch(`${API_URL}/users/me/presence`, {
          method: "PATCH",
          headers: { Authorization: "Bearer " + token },
        }).catch(() => undefined);

      void updatePresence();
      const heartbeat = window.setInterval(updatePresence, 30_000);
      return () => {
        window.clearInterval(heartbeat);
        presenceSocket.disconnect();
      };
    }
  }, []);

  return (
    <CurrentUserContext.Provider value={{ user, isLoading, setUser }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error("useCurrentUser must be used within a CurrentUserProvider");
  }
  return context;
}
