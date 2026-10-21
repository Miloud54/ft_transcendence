"use client";

import Link from "next/link";
import { FormEvent, useState, useEffect } from "react";
import type { Socket } from "socket.io-client";

import { motion } from "framer-motion";
import { useCurrentUser } from "@/lib/current-user-context";
import type { RoomPlayer } from "@/lib/room-api";
import type { GameState, GuessResult } from "@/lib/game-socket";


const TEAMMATE_COLORS = ["bg-violet-500", "bg-violet-300", "bg-violet-400", "bg-zinc-400"];

function buildInitialAttempts(players: RoomPlayer[], you: RoomPlayer | undefined) {
  const teammates = players.filter((player) => player.id !== you?.id);

  return teammates.map((teammate, index) => ({
      username: teammate.username,
      avatarUrl: teammate.avatarUrl,
      word: "—",
      proximity: 0,
      color: TEAMMATE_COLORS[index % TEAMMATE_COLORS.length],
    }));
}

type Attempt = {
  username: string;
  avatarUrl: string | null;
  word: string;
  proximity: number;
  color: string;
};

type ArticleWord = {
  kind: "word" | "separator";
  label: string;
  status: "found" | "hidden";
  length: number;
  grade: number;
  closestGuess: string | null;
};

// Hidden words get warmer as they get closer to a previous guess (grade 1..4).
const GRADE_CLASSES = [
  "bg-zinc-100",
  "bg-lime-200",
  "bg-lime-400",
  "bg-violet-200",
  "bg-violet-400",
];

const GRADE_TEXT_CLASSES = [
  "text-zinc-400",
  "text-zinc-500",
  "text-zinc-600",
  "text-white",
  "text-white",
];

function ArticleText({
  paragraph,
  className = "text-base leading-8 text-zinc-700 sm:text-lg",
  lastFoundWord = null,
}: {
  paragraph: ArticleWord[];
  className?: string;
  lastFoundWord?: string | null;
}) {
  return (
    <p className={className}>
      {paragraph.map((word, index) => {
        if (word.kind === "separator") {
          return <span key={index}>{word.label}</span>;
        }
        if (word.status === "found") {
          const isLastFound = lastFoundWord !== null && word.label.toLowerCase() === lastFoundWord;
          return (
            <span
              key={index}
              className={`border-b-2 border-lime-400 ${
                isLastFound ? "font-semibold text-violet-700" : "text-zinc-950"
              }`}
            >
              {word.label}
            </span>
          );
        }
        return (
          <span
            key={index}
            aria-label={
              word.closestGuess
                ? `Hidden word, closest guess: ${word.closestGuess}`
                : word.grade > 0
                  ? "Hidden word, close to a guess"
                  : "Hidden word"
            }
            style={{ minWidth: `${Math.max(word.length, 2) * 0.6}rem` }}
            className={`mx-0.5 inline-flex h-6 items-center justify-center rounded px-1 align-middle text-xs font-medium ${
              GRADE_TEXT_CLASSES[Math.min(word.grade, 4)]
            } ${GRADE_CLASSES[Math.min(word.grade, 4)]}`}
          >
            {word.closestGuess ?? ""}
          </span>
        );
      })}
    </p>
  );
}

const REJECTION_MESSAGES: Record<string, string> = {
  EMPTY: "Enter a word before submitting your attempt.",
  TOO_LONG: "That guess is too long.",
  SINGLE_WORD_ONLY: "One word at a time (or the full title).",
  NOT_A_WORD: "That does not look like an English word.",
  ALREADY_GUESSED: "That word was already tried.",
  GAME_FINISHED: "The game is over.",
  TOO_FAST: "Slow down a little.",
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function toArticleWords(
  tokens: NonNullable<GameState["article"]>["paragraphs"][number]["tokens"],
): ArticleWord[] {
  return tokens.map((token) =>
    token.type === "separator"
      ? { kind: "separator", label: token.display, status: "hidden", length: 0, grade: 0, closestGuess: null }
      : token.status === "revealed"
        ? { kind: "word", label: token.display, status: "found", length: token.length, grade: 0, closestGuess: null }
        : {
            kind: "word",
            label: "",
            status: "hidden",
            length: token.length,
            grade: token.grade ?? 0,
            closestGuess: token.closestGuess ?? null,
          },
  );
}

function articleParagraphs(gameState: GameState | null): ArticleWord[][] {
  return gameState?.article?.paragraphs.map((p) => toArticleWords(p.tokens)) ?? [];
}

function articleTitle(gameState: GameState | null): ArticleWord[] {
  return toArticleWords(gameState?.article?.title.tokens ?? []);
}

export function GameBoard({
  gameId,
  players,
  gameState,
  socket,
  lastGuess,
}: {
  gameId: string;
  players: RoomPlayer[];
  gameState: GameState | null;
  socket: Socket | null;
  lastGuess: GuessResult | null;
}) {
  const { user } = useCurrentUser();
  const you = players.find((player) => player.id === user?.id);

  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>(() => buildInitialAttempts(players, you));
  const [notice, setNotice] = useState("Find the word closest to the secret article.");
  const [bestScore, setBestScore] = useState(0);
  const [lastFoundWord, setLastFoundWord] = useState<string | null>(null);

  useEffect(() => {
    if (!lastGuess) return;
    const mine = lastGuess.userId === you?.id;
    const timeout = setTimeout(() => {
      if (!lastGuess.valid) {
        if (mine) {
          setNotice(REJECTION_MESSAGES[lastGuess.reason ?? ""] ?? "That guess was rejected.");
        }
        return;
      }

      const author = mine ? you : players.find((player) => player.id === lastGuess.userId);
      const username = mine ? "You" : (author?.username ?? "Player");
      setAttempts((currentAttempts) => [
        {
          username,
          avatarUrl: author?.avatarUrl ?? null,
          word: lastGuess.guess,
          proximity: lastGuess.score,
          color: mine ? "bg-lime-400" : "bg-violet-400",
        },
        ...currentAttempts.filter((attempt) => attempt.username !== username),
      ]);

      if (lastGuess.valid && lastGuess.revealedCount > 0) {
        setLastFoundWord(lastGuess.guess.toLowerCase());
      }

      if (!mine) return;
      setBestScore((currentBest) => Math.max(currentBest, lastGuess.score));
      setGuess("");
      setNotice(
        lastGuess.correct
          ? "Well done, you found the secret article!"
          : lastGuess.revealedCount > 0
            ? `"${lastGuess.guess}" found: ${lastGuess.revealedCount} word${lastGuess.revealedCount > 1 ? "s" : ""} revealed (+${lastGuess.score}).`
            : lastGuess.bestGrade > 0
              ? `"${lastGuess.guess}" is not in the text, but it is close to some words.`
              : `"${lastGuess.guess}" is not in the text and nothing is close.`,
      );
    }, 0);

    return () => clearTimeout(timeout);
  }, [lastGuess, you, players]);
  const currentScore = gameState?.scores[user?.id ?? ""] ?? bestScore;
  const currentAttemptCount = gameState?.attempts[user?.id ?? ""] ?? 0;
  const paragraphs = articleParagraphs(gameState);
  const titleWords = articleTitle(gameState);
  const bodyWords = paragraphs.flat().filter((word) => word.kind === "word");
  const discoveredCount = bodyWords.filter((word) => word.status === "found").length;
  const hottestGrade = Math.max(0, ...bodyWords.map((word) => word.grade));
  const temperaturePercent = Math.round((hottestGrade / 4) * 100);  
  const isSolved = gameState?.status === "finished";
  const titleText = titleWords.map((word) => word.label).join("");
  const winner = players.find((player) => player.id === gameState?.winnerId);
  const getAttemptScore = (attempt: Attempt) =>
    gameState?.scores[(attempt.username === "You" ? you : players.find((player) => player.username === attempt.username))?.id ?? ""] ?? 0;
  const sortedAttempts = [...attempts].sort((a, b) => getAttemptScore(b) - getAttemptScore(a));  
  const [previousPlayers, setPreviousPlayers] = useState(players);
  if (players !== previousPlayers) {
    setPreviousPlayers(players);
    setAttempts((current) => {
      const withYourAvatar = current.map((attempt) =>
        attempt.username === "You" && !attempt.avatarUrl && you?.avatarUrl
          ? { ...attempt, avatarUrl: you.avatarUrl }
          : attempt,
      );

      const existingUsernames = new Set(withYourAvatar.map((attempt) => attempt.username));
      const missingTeammates = players
        .filter((player) => player.id !== you?.id && !existingUsernames.has(player.username))
        .map((player, index) => ({
          username: player.username,
          avatarUrl: player.avatarUrl,
          word: "—",
          proximity: 0,
          color: TEAMMATE_COLORS[index % TEAMMATE_COLORS.length],
        }));

      return missingTeammates.length > 0 ? [...withYourAvatar, ...missingTeammates] : withYourAvatar;
    });
  }

  async function handleLeaveGame() {
    if (!window.confirm("Leave this game? You will be marked as having lost.")) {
      return;
    }
    socket?.emit("game:leave", { gameId });
    try {
      const token = localStorage.getItem("accessToken");
      await fetch(`/api/game/${gameId}/leave`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    } finally {
      window.location.href = "/home";
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const word = guess.trim();

    if (!word) {
      setNotice("Enter a word before submitting your attempt.");
      return;
    }

    if (!socket) {
      setNotice("The game connection is not ready.");
      return;
    }

    if (gameState?.status !== "running" || !gameState.article) {
      setNotice("The article is still being prepared. Try again when the game starts.");
      return;
    }

    socket.emit("game:guess", { gameId, guess: word });
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
      className="mx-auto max-w-7xl space-y-6"
    >
      <motion.header
        variants={fadeUp}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col gap-2 border-b border-zinc-200 pb-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
            <span className="h-2 w-2 rounded-full bg-lime-500" />
            {gameState?.status === "countdown"
              ? `Starting in ${gameState.countdownRemaining}s`
              : gameState?.status === "finished"
                ? "Game finished"
                : "Game in progress"} · #{gameId}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">The secret word</h1>
          <p className="mt-1 text-sm text-zinc-500">One Wikipedia article, one board shared by every player, only one right answer.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2">
            <span className="block text-xs text-zinc-400">Time</span>
            <strong className="font-mono text-zinc-900">
              {gameState?.status === "countdown"
                ? `${gameState.countdownRemaining}s`
                : gameState?.status === "running"
                  ? "In progress"
                  : "—"}
            </strong>
          </div>
                 <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2">
            <span className="block text-xs text-zinc-400">Players</span>
            <strong className="text-zinc-900">{players.length} online</strong>
          </div>
          <button
            type="button"
            onClick={handleLeaveGame}
            className="rounded-lg bg-[#d03b3b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#b83232]"
          >
            Leave game
          </button>
        </div>
      </motion.header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-6">
          <motion.section variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Scrambled article</p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-950">Fill in the missing words</h2>
              </div>
              <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-semibold text-lime-800">{discoveredCount}/{bodyWords.length} found</span>
            </div>
            <div className="space-y-4 px-5 py-5 sm:px-10 sm:py-6">
              <div className="border-b border-zinc-100 pb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Article excerpt</p>
                {titleWords.length > 0 ? (
                  <ArticleText paragraph={titleWords} className="mt-1 text-2xl font-semibold leading-10 text-zinc-950" lastFoundWord={lastFoundWord} />
                ) : (
                  <h3 className="mt-2 text-2xl font-semibold text-zinc-950">Encyclopedia article</h3>
                )}
              </div>
              <div className="max-h-[420px] max-w-4xl space-y-5 overflow-y-auto pr-3">
                {paragraphs.length === 0 ? (
                  <p className="text-sm text-zinc-500">Waiting for the game article...</p>
                ) : paragraphs.map((paragraph, index) => (
                  <ArticleText key={index} paragraph={paragraph} className="text-sm leading-7 text-zinc-700" lastFoundWord={lastFoundWord} />
                ))}
              </div>
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
                  disabled={gameState?.status !== "running" || !gameState.article}
                />
                <button
                  className="rounded-lg bg-violet-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  type="submit"
                  disabled={gameState?.status !== "running" || !gameState.article}
                >
                  Guess
                </button>
              </form>
              <p className="mt-3 text-xs text-zinc-500" aria-live="polite">{notice}</p>
            </div>
          </motion.section>

        </main>

        <aside className="space-y-6">
          <motion.section variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-zinc-950">Temperature</h2>
              <span className="text-xs text-zinc-400">proximity</span>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-gradient-to-r from-lime-400 to-violet-700">
              <div className="h-full border-r-2 border-white" style={{ width: `${temperaturePercent}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-zinc-400"><span>Cold</span><span>Scorching</span></div>

          </motion.section>

          <motion.section variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-zinc-950">Live leaderboard</h2>
              <span className="h-2 w-2 rounded-full bg-lime-500" />
            </div>
            <div className="mt-4 space-y-3">
              {sortedAttempts.map((attempt, index) => (
                <div key={`${attempt.username}-${attempt.word}-${index}`} className="flex items-center gap-3">
                  {attempt.avatarUrl ? (
                    <img src={attempt.avatarUrl} alt={attempt.username} className="h-8 w-8 rounded-full bg-zinc-100" />
                  ) : (
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${attempt.color} text-xs font-bold text-zinc-900`}>{attempt.username.charAt(0)}</span>
                  )}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-zinc-800">{attempt.username}</p><p className="truncate text-xs text-zinc-400">{attempt.word}</p></div>
                  <span className="font-mono text-sm font-semibold text-zinc-700">
                    {getAttemptScore(attempt)}
                  </span>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }} className="rounded-2xl bg-violet-700 p-5 text-white">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-200">Best score</p>
                <p className="mt-1 text-lg font-semibold">{currentScore.toLocaleString("en-US")}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-200">Attempts</p>
                <p className="mt-1 text-lg font-semibold">{currentAttemptCount}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-200">Streak</p>
                <p className="mt-1 text-lg font-semibold">x3</p>
              </div>
            </div>
          </motion.section>

          {isSolved && (
            <motion.div variants={fadeUp} transition={{ duration: 0.4, ease: "easeOut" }} className="rounded-2xl border border-lime-300 bg-lime-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-lime-800">Article found</p>
              <p className="mt-1 text-lg font-semibold text-lime-950">{titleText}</p>
              {winner && <p className="mt-1 text-sm text-lime-900">Found by {winner.id === you?.id ? "you" : winner.username}</p>}
              <Link href={`/results/${gameId}`} className="mt-4 block rounded-lg bg-lime-400 px-4 py-2.5 text-center text-sm font-semibold text-violet-950 hover:bg-lime-300">View results</Link>
            </motion.div>
          )}
        </aside>
      </div>
    </motion.div>
  );
}