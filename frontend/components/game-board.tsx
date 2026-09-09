"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const INITIAL_ATTEMPTS = [
  { username: "Vous", word: "tour", proximity: 1000, color: "bg-lime-400" },
  { username: "Odile", word: "metallique", proximity: 842, color: "bg-violet-500" },
  { username: "Maria", word: "fer", proximity: 615, color: "bg-rose-400" },
];

const ARTICLE_PARAGRAPHS = [
  [
    { label: "La", status: "found" },
    { label: "tour", status: "found" },
    { label: "de", status: "hidden" },
    { label: "fer", status: "found" },
    { label: "puddlé", status: "hidden" },
    { label: "est", status: "found" },
    { label: "un", status: "hidden" },
    { label: "monument", status: "found" },
    { label: "emblématique", status: "hidden" },
    { label: "de", status: "hidden" },
    { label: "Paris", status: "hidden" },
    { label: "en", status: "hidden" },
    { label: "France", status: "hidden" },
    { label: ".", status: "found" },
  ],
  [
    { label: "Construite", status: "hidden" },
    { label: "pour", status: "hidden" },
    { label: "l'Exposition", status: "hidden" },
    { label: "universelle", status: "hidden" },
    { label: "de", status: "hidden" },
    { label: "1889", status: "hidden" },
    { label: ",", status: "found" },
    { label: "elle", status: "found" },
    { label: "porte", status: "hidden" },
    { label: "le", status: "hidden" },
    { label: "nom", status: "hidden" },
    { label: "de", status: "hidden" },
    { label: "l'ingénieur", status: "hidden" },
    { label: "Gustave", status: "hidden" },
    { label: "Eiffel", status: "hidden" },
    { label: ".", status: "found" },
  ],
  [
    { label: "Haute", status: "hidden" },
    { label: "de", status: "hidden" },
    { label: "330", status: "hidden" },
    { label: "mètres", status: "hidden" },
    { label: ",", status: "found" },
    { label: "elle", status: "found" },
    { label: "a", status: "hidden" },
    { label: "été", status: "hidden" },
    { label: "pendant", status: "hidden" },
    { label: "longtemps", status: "hidden" },
    { label: "la", status: "hidden" },
    { label: "structure", status: "hidden" },
    { label: "la", status: "hidden" },
    { label: "plus", status: "hidden" },
    { label: "haute", status: "hidden" },
    { label: "du", status: "hidden" },
    { label: "monde", status: "hidden" },
    { label: ".", status: "found" },
  ],
];

const WORD_SCORES: Record<string, number> = {
  eiffel: 1000,
  tour: 1000,
  fer: 615,
  paris: 540,
  monument: 488,
  acier: 430,
  france: 322,
};

function getProximity(word: string) {
  const normalizedWord = word.trim().toLowerCase();
  return WORD_SCORES[normalizedWord] ?? Math.max(70, 400 - normalizedWord.length * 19);
}

type ArticleWordStatus = "found" | "hidden";

type ArticleWord = { label: string; status: ArticleWordStatus };

function ArticleText({ paragraph }: { paragraph: ArticleWord[] }) {
    <p className="text-base leading-8 text-zinc-700 sm:text-lg">
      {paragraph.map((word, index) => (
        <span key={`${word.label}-${index}`}>
          {word.status === "found" ? (
            <span className="border-b-2 border-lime-400 text-zinc-950">{word.label}</span>
          ) : (
            <span
              aria-label="Mot masqué"
              className="mx-1 inline-block h-7 min-w-12 select-none rounded bg-zinc-100 align-middle text-[0]"
            />
          )}{" "}
        </span>
      ))}
    </p>
  );
}

export function GameBoard({ gameId }: { gameId: string }) {
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState(INITIAL_ATTEMPTS);
  const [discoveredCount, setDiscoveredCount] = useState(3);
  const [isSolved, setIsSolved] = useState(false);
  const [notice, setNotice] = useState("Trouvez le mot le plus proche de l'article secret.");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const word = guess.trim();

    if (!word) {
      setNotice("Écrivez un mot avant de valider votre tentative.");
      return;
    }

    const proximity = getProximity(word);
    const isCorrect = word.toLowerCase() === "eiffel" || word.toLowerCase() === "tour eiffel";

    setAttempts((currentAttempts) => [
      { username: "Vous", word, proximity, color: "bg-lime-400" },
      ...currentAttempts.filter((attempt) => attempt.username !== "Vous"),
    ]);
    setGuess("");

    if (isCorrect) {
      setIsSolved(true);
      setNotice("Bravo, vous avez trouvé l'article secret.");
      return;
    }

    setDiscoveredCount((count) => Math.min(12, count + (proximity > 500 ? 1 : 0)));
    setNotice(proximity > 500 ? "Vous êtes très proche. Continuez dans cette direction." : "Encore un peu froid, explorez un autre champ lexical.");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
            <span className="h-2 w-2 rounded-full bg-lime-500" />
            Partie en cours · #{gameId}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">Le mot secret</h1>
          <p className="mt-1 text-sm text-zinc-500">Un article Wikipedia, 12 indices visibles, une seule bonne réponse.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2">
            <span className="block text-xs text-zinc-400">Temps</span>
            <strong className="font-mono text-zinc-900">04:28</strong>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2">
            <span className="block text-xs text-zinc-400">Joueurs</span>
            <strong className="text-zinc-900">3 en ligne</strong>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Article brouillé</p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-950">Complétez les mots manquants</h2>
              </div>
              <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-semibold text-lime-800">{discoveredCount}/12 trouvés</span>
            </div>
            <div className="space-y-6 px-5 py-8 sm:px-10 sm:py-12">
              <div className="border-b border-zinc-100 pb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Extrait de l'article</p>
                <h3 className="mt-2 text-2xl font-semibold text-zinc-950">Article encyclopédique</h3>
              </div>
              <div className="max-w-4xl space-y-5">
                {ARTICLE_PARAGRAPHS.map((paragraph, index) => (
                  <ArticleText key={index} paragraph={paragraph} />
                ))}
              </div>
              <details className="max-w-4xl rounded-lg border border-dashed border-zinc-200 px-4 py-3 text-sm text-zinc-500">
                <summary className="cursor-pointer font-medium text-zinc-700">Voir les indices de structure</summary>
                <p className="mt-2 leading-6">Le texte contient des informations sur la construction, l'histoire et les dimensions du monument.</p>
              </details>
            </div>
            <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-4 sm:px-7">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
                <label className="sr-only" htmlFor="guess">Votre proposition</label>
                <input
                  id="guess"
                  value={guess}
                  onChange={(event) => setGuess(event.target.value)}
                  placeholder="Entrez un mot..."
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  autoComplete="off"
                />
                <button className="rounded-lg bg-violet-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-800" type="submit">
                  Deviner
                </button>
              </form>
              <p className="mt-3 text-xs text-zinc-500" aria-live="polite">{notice}</p>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Meilleur score</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">1 000</p>
              <p className="mt-1 text-xs text-lime-700">Votre meilleur mot</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Tentatives</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">{attempts.length}</p>
              <p className="mt-1 text-xs text-zinc-500">Cette partie</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Série actuelle</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">x3</p>
              <p className="mt-1 text-xs text-zinc-500">Mots découverts</p>
            </div>
          </section>
        </main>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-zinc-950">Température</h2>
              <span className="text-xs text-zinc-400">proximité</span>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-gradient-to-r from-sky-400 via-amber-300 to-rose-500">
              <div className="h-full w-[68%] border-r-2 border-white" />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-zinc-400"><span>Froid</span><span>Brûlant</span></div>
            <div className="mt-5 rounded-lg bg-lime-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-lime-800">Dernier indice</p>
              <p className="mt-1 text-sm font-medium text-lime-950">Les mots liés à la matière sont proches.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-zinc-950">Classement live</h2>
              <span className="h-2 w-2 rounded-full bg-lime-500" />
            </div>
            <div className="mt-4 space-y-3">
              {attempts.map((attempt, index) => (
                <div key={`${attempt.username}-${attempt.word}-${index}`} className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${attempt.color} text-xs font-bold text-zinc-900`}>{attempt.username.charAt(0)}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-zinc-800">{attempt.username}</p><p className="truncate text-xs text-zinc-400">{attempt.word}</p></div>
                  <span className="font-mono text-sm font-semibold text-zinc-700">{attempt.proximity}</span>
                </div>
              ))}
            </div>
          </section>

          {isSolved ? (
            <div className="rounded-2xl border border-lime-300 bg-lime-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-lime-800">Article trouvé</p>
              <p className="mt-1 text-lg font-semibold text-lime-950">La Tour Eiffel</p>
              <Link href={`/results/${gameId}`} className="mt-4 block rounded-lg bg-lime-400 px-4 py-2.5 text-center text-sm font-semibold text-violet-950 hover:bg-lime-300">Voir les résultats</Link>
            </div>
          ) : (
            <div className="rounded-2xl bg-violet-700 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">Objectif bonus</p>
              <p className="mt-2 text-lg font-semibold">Trouvez l'article en moins de 10 mots.</p>
              <p className="mt-2 text-sm leading-6 text-violet-100">Chaque mot chaud révèle progressivement le texte original.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
