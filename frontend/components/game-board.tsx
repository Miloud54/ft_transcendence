"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const INITIAL_ATTEMPTS = [
  { username: "You", word: "tower", proximity: 1000, color: "bg-lime-400" },
  { username: "Odile", word: "metallic", proximity: 842, color: "bg-violet-500" },
  { username: "Maria", word: "iron", proximity: 615, color: "bg-rose-400" },
];

const ARTICLE_PARAGRAPHS: ArticleWord[][] = [
  [
    { label: "The", status: "found" },
    { label: "Eiffel", status: "hidden" },
    { label: "Tower", status: "hidden" },
    { label: "is", status: "found" },
    { label: "a", status: "hidden" },
    { label: "wrought-iron", status: "hidden" },
    { label: "lattice", status: "hidden" },
    { label: "tower", status: "found" },
    { label: "and", status: "hidden" },
    { label: "landmark", status: "found" },
    { label: "of", status: "hidden" },
    { label: "Paris", status: "hidden" },
    { label: "in", status: "hidden" },
    { label: "France", status: "hidden" },
    { label: ".", status: "found" },
  ],
  [
    { label: "Built", status: "hidden" },
    { label: "for", status: "hidden" },
    { label: "the", status: "hidden" },
    { label: "1889", status: "hidden" },
    { label: "World's", status: "hidden" },
    { label: "Fair", status: "hidden" },
    { label: ",", status: "found" },
    { label: "it", status: "found" },
    { label: "is", status: "hidden" },
    { label: "named", status: "hidden" },
    { label: "after", status: "hidden" },
    { label: "the", status: "hidden" },
    { label: "engineer", status: "hidden" },
    { label: "Gustave", status: "hidden" },
    { label: "Eiffel", status: "hidden" },
    { label: ".", status: "found" },
  ],
  [
    { label: "Standing", status: "hidden" },
    { label: "330", status: "hidden" },
    { label: "meters", status: "hidden" },
    { label: "tall", status: "hidden" },
    { label: ",", status: "found" },
    { label: "it", status: "found" },
    { label: "was", status: "hidden" },
    { label: "for", status: "hidden" },
    { label: "a", status: "hidden" },
    { label: "long", status: "hidden" },
    { label: "time", status: "hidden" },
    { label: "the", status: "hidden" },
    { label: "tallest", status: "hidden" },
    { label: "structure", status: "hidden" },
    { label: "in", status: "hidden" },
    { label: "the", status: "hidden" },
    { label: "world", status: "hidden" },
    { label: ".", status: "found" },
  ],
];

const WORD_SCORES: Record<string, number> = {
  eiffel: 1000,
  tower: 1000,
  "eiffel tower": 1000,
  iron: 615,
  paris: 540,
  monument: 488,
  steel: 430,
  france: 322,
};

function getProximity(word: string) {
  const normalizedWord = word.trim().toLowerCase();
  return WORD_SCORES[normalizedWord] ?? Math.max(70, 400 - normalizedWord.length * 19);
}

type ArticleWordStatus = "found" | "hidden";

type ArticleWord = { label: string; status: ArticleWordStatus };

function ArticleText({ paragraph }: { paragraph: ArticleWord[] }) {
  return (
    <p className="text-base leading-8 text-zinc-700 sm:text-lg">
      {paragraph.map((word, index) => (
        <span key={`${word.label}-${index}`}>
          {word.status === "found" ? (
            <span className="border-b-2 border-lime-400 text-zinc-950">{word.label}</span>
          ) : (
            <span
              aria-label="Hidden word"
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
  const [notice, setNotice] = useState("Find the word closest to the secret article.");
  const [bestScore, setBestScore] = useState(
    Math.max(...INITIAL_ATTEMPTS.filter((attempt) => attempt.username === "You").map((attempt) => attempt.proximity)),
  );
  const [attemptCount, setAttemptCount] = useState(0);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const word = guess.trim();

    if (!word) {
      setNotice("Enter a word before submitting your attempt.");
      return;
    }

    const proximity = getProximity(word);
    const isCorrect = word.toLowerCase() === "eiffel" || word.toLowerCase() === "eiffel tower";

    setAttempts((currentAttempts) => [
      { username: "You", word, proximity, color: "bg-lime-400" },
      ...currentAttempts.filter((attempt) => attempt.username !== "You"),
    ]);
    setBestScore((currentBest: number) => Math.max(currentBest, proximity));
    setAttemptCount((count: number) => count + 1);
    setGuess("");

    if (isCorrect) {
      setIsSolved(true);
      setNotice("Well done, you found the secret article!");
      return;
    }

    setDiscoveredCount((count) => Math.min(12, count + (proximity > 500 ? 1 : 0)));
    setNotice(proximity > 500 ? "You're very close. Keep going in that direction." : "Still a bit cold, try a different angle.");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
            <span className="h-2 w-2 rounded-full bg-lime-500" />
            Game in progress · #{gameId}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">The secret word</h1>
          <p className="mt-1 text-sm text-zinc-500">One Wikipedia article, 12 visible clues, only one right answer.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2">
            <span className="block text-xs text-zinc-400">Time</span>
            <strong className="font-mono text-zinc-900">04:28</strong>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2">
            <span className="block text-xs text-zinc-400">Players</span>
            <strong className="text-zinc-900">3 online</strong>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Scrambled article</p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-950">Fill in the missing words</h2>
              </div>
              <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-semibold text-lime-800">{discoveredCount}/12 found</span>
            </div>
            <div className="space-y-6 px-5 py-8 sm:px-10 sm:py-12">
              <div className="border-b border-zinc-100 pb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Article excerpt</p>
                <h3 className="mt-2 text-2xl font-semibold text-zinc-950">Encyclopedia article</h3>
              </div>
              <div className="max-w-4xl space-y-5">
                {ARTICLE_PARAGRAPHS.map((paragraph, index) => (
                  <ArticleText key={index} paragraph={paragraph} />
                ))}
              </div>
              <details className="max-w-4xl rounded-lg border border-dashed border-zinc-200 px-4 py-3 text-sm text-zinc-500">
                <summary className="cursor-pointer font-medium text-zinc-700">View structural hints</summary>
                <p className="mt-2 leading-6">The text contains information about the construction, history, and dimensions of the monument.</p>
              </details>
            </div>
            <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-4 sm:px-7">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
                <label className="sr-only" htmlFor="guess">Your guess</label>
                <input
                  id="guess"
                  value={guess}
                  onChange={(event) => setGuess(event.target.value)}
                  placeholder="Enter a word..."
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  autoComplete="off"
                />
                <button className="rounded-lg bg-violet-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-800" type="submit">
                  Guess
                </button>
              </form>
              <p className="mt-3 text-xs text-zinc-500" aria-live="polite">{notice}</p>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Best score</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">{bestScore.toLocaleString("en-US")}</p>
              <p className="mt-1 text-xs text-lime-700">Your best word</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Attempts</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">{attemptCount}</p>
              <p className="mt-1 text-xs text-zinc-500">This game</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Current streak</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">x3</p>
              <p className="mt-1 text-xs text-zinc-500">Words discovered</p>
            </div>
          </section>
        </main>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-zinc-950">Temperature</h2>
              <span className="text-xs text-zinc-400">proximity</span>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-gradient-to-r from-sky-400 via-amber-300 to-rose-500">
              <div className="h-full w-[68%] border-r-2 border-white" />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-zinc-400"><span>Cold</span><span>Scorching</span></div>
            <div className="mt-5 rounded-lg bg-lime-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-lime-800">Latest hint</p>
              <p className="mt-1 text-sm font-medium text-lime-950">Words related to materials are close.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-zinc-950">Live leaderboard</h2>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-lime-800">Article found</p>
              <p className="mt-1 text-lg font-semibold text-lime-950">The Eiffel Tower</p>
              <Link href={`/results/${gameId}`} className="mt-4 block rounded-lg bg-lime-400 px-4 py-2.5 text-center text-sm font-semibold text-violet-950 hover:bg-lime-300">View results</Link>
            </div>
          ) : (
            <div className="rounded-2xl bg-violet-700 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">Bonus objective</p>
              <p className="mt-2 text-lg font-semibold">Find the article in under 10 words.</p>
              <p className="mt-2 text-sm leading-6 text-violet-100">Each hot word gradually reveals the original text.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
