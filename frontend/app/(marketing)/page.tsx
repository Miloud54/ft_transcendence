import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accueil",
};

export default function LandingPage() {
  return (
    <section className="flex flex-1 items-center px-6 py-24">
      <div className="mx-auto grid w-full max-w-6xl gap-12 md:grid-cols-2 md:items-center">
        <div>
          <span className="inline-block rounded-full bg-lime-100 px-3 py-1 text-xs font-medium text-lime-800">
            Nouveau — multijoueur en temps réel
          </span>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
            Trouve la page avant les autres
          </h1>

          <p className="mt-4 max-w-md text-lg text-zinc-600">
            Jeu de devinettes sémantiques multijoueur en temps réel
          </p>
        </div>

        <div className="flex aspect-video items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-400">
          aperçu du jeu
        </div>
      </div>
    </section>
  );
}