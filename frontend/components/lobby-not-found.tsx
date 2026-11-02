import Link from "next/link";

export function LobbyNotFound({ message = "This lobby could not be found." }: { message?: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-100 text-4xl">
        ?
      </div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
        Lobby unavailable
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
        We couldn&apos;t find that lobby
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">{message}</p>
      <Link
        href="/home"
        className="mt-8 rounded-md bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-800"
      >
        Back to home
      </Link>
    </div>
  );
}
