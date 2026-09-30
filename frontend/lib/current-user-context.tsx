"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
  setUser: (user: CurrentUser) => void;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
    const token = localStorage.getItem("accessToken");

    fetch("http://localhost:3001/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load current user.");
        return response.json();
      })
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
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
