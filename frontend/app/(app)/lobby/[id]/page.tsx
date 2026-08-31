import type { Metadata } from "next";
import { mockLobbyPlayers } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Lobby",
};

const MAX_PLAYERS = 6;

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const slots = Array.from({ length: MAX_PLAYERS }, (_, index) => mockLobbyPlayers[index] ?? null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">Lobby de partie</h1>
        <p className="text-sm text-zinc-500">En attente des joueurs · Partie #{id}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((player, index) =>
          player ? (
            <div
              key={player.id}
              className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white p-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-lg font-semibold text-violet-700">
                {player.username.charAt(0)}
              </div>
              <span className="text-sm font-medium text-zinc-950">{player.username}</span>
              <span
                className={`text-xs font-medium ${
                  player.isReady ? "text-[#0ca30c]" : "text-zinc-400"
                }`}
              >
                {player.isHost ? "Hôte" : player.isReady ? "Prêt" : "Pas prêt"}
              </span>
            </div>
          ) : (
            <div
              key={`empty-${index}`}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 p-6 text-zinc-400"
            >
              <span className="text-xl">+</span>
              <span className="text-sm">Inviter</span>
            </div>
          )
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-sm font-medium text-zinc-700">Chat du lobby</p>
        <div className="mt-3 h-24 rounded-md bg-zinc-50" />
      </div>

      <button className="w-full rounded-md bg-lime-400 py-3 text-sm font-semibold text-violet-900 sm:w-auto sm:px-8">
        Lancer la partie
      </button>
    </div>
  );
}
