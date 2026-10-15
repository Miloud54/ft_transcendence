// "use client";

// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import { useEffect, useState } from "react";
// import { useCurrentUser } from "@/lib/current-user-context";
// import { API_URL } from "@/lib/room-api";

// type ActiveGame = { roomId: string; gameId: string } | null;

// export function ActiveGameButton() {
//   const { user } = useCurrentUser();
//   const pathname = usePathname();
//   const [activeGame, setActiveGame] = useState<ActiveGame>(null);
//   const [activeGameError, setActiveGameError] = useState<string | null>(null);

//   useEffect(() => {
//     if (user?.status !== "IN_GAME") {
//       return;
//     }

//     const token = localStorage.getItem("accessToken");
//     void fetch(`${API_URL}/users/me/active-game`, {
//       headers: { Authorization: `Bearer ${token}` },
//     })
//       .then(async (response) => {
//         const data = await response.json().catch(() => null);
//         if (!response.ok) {
//           throw new Error(
//             typeof data?.message === "string"
//               ? data.message
//               : "Could not restore the active game.",
//           );
//         }
//         return data as ActiveGame;
//       })
//       .then((game) => {
//         setActiveGame(game);
//         setActiveGameError(null);
//       })
//       .catch((requestError: unknown) => {
//         setActiveGame(null);
//         setActiveGameError(
//           requestError instanceof Error
//             ? requestError.message
//             : "Could not restore the active game.",
//         );
//       });
//   }, [user?.status]);

//   if (user?.status !== "IN_GAME" || pathname.startsWith("/game/")) {
//     return null;
//   }

//   if (!activeGame) {
//     return activeGameError ? (
//       <span className="text-xs text-lime-200">{activeGameError}</span>
//     ) : null;
//   }

//   return (
//     <Link
//       href={`/game/${activeGame.gameId}?room=${activeGame.roomId}`}
//       className="rounded-full bg-lime-400 px-3 py-1.5 text-xs font-semibold text-violet-950 hover:bg-lime-300"
//     >
//       Back to game
//     </Link>
//   );
// }


"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/current-user-context";
import { API_URL } from "@/lib/room-api";

type ActiveGame = { roomId: string; gameId: string } | null;

export function ActiveGameButton() {
  const { user } = useCurrentUser();
  const pathname = usePathname();
  const [activeGame, setActiveGame] = useState<ActiveGame>(null);
  const [activeGameError, setActiveGameError] = useState<string | null>(null);

  const userId = user?.id;
  const onGamePage = pathname.startsWith("/game/");

  useEffect(() => {
    if (!userId || onGamePage) {
      return;
    }

    let cancelled = false;
    const token = localStorage.getItem("accessToken");

    fetch(`${API_URL}/users/me/active-game`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            typeof data?.message === "string"
              ? data.message
              : "Could not restore the active game.",
          );
        }
        return data as ActiveGame;
      })
      .then((game) => {
        if (cancelled) return;
        setActiveGame(game);
        setActiveGameError(null);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        setActiveGame(null);
        setActiveGameError(
          requestError instanceof Error
            ? requestError.message
            : "Could not restore the active game.",
        );
      });

    return () => {
      cancelled = true;
    };
    // Re-check whenever the user navigates, e.g. after leaving a game page
  }, [userId, onGamePage, pathname]);

  if (!userId || onGamePage) {
    return null;
  }

  if (!activeGame) {
    return activeGameError ? (
      <span className="text-xs text-lime-200">{activeGameError}</span>
    ) : null;
  }

  return (
    <Link
      href={`/game/${activeGame.gameId}?room=${activeGame.roomId}`}
      className="rounded-full bg-lime-400 px-3 py-1.5 text-xs font-semibold text-violet-950 hover:bg-lime-300"
    >
      Back to game
    </Link>
  );
}