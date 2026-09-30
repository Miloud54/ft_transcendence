import type { Metadata } from "next";
import Link from "next/link";
import { GuestOnly } from "@/components/guest-only";

export const metadata: Metadata = {
  title: "Transcendix — find the article first",
};

const PREVIEW_WORDS = [
  { label: "The", status: "found" },
  { label: "Eiffel", status: "hidden" },
  { label: "Tower", status: "hidden" },
  { label: "is", status: "found" },
  { label: "a", status: "hidden" },
  { label: "wrought-iron", status: "hidden" },
  { label: "landmark", status: "found" },
  { label: "of", status: "hidden" },
  { label: "Paris", status: "hidden" },
  { label: ".", status: "found" },
] as const;

const STEPS = [
  {
    number: "1",
    title: "Create or join a room",
    description: "Start a room and share the code, or jump into an open one from the lobby list.",
  },
  {
    number: "2",
    title: "Guess words, not the title",
    description: "Every word you submit reveals how close it is to the hidden Wikipedia article.",
  },
  {
    number: "3",
    title: "Race to find it first",
    description: "Track your rivals' guesses live and piece the article together before they do.",
  },
];

export default function LandingPage() {
  return (
    <GuestOnly>
      <section className="flex flex-1 flex-col items-center px-6 py-24">
        <div className="mx-auto grid w-full max-w-6xl gap-12 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-block rounded-full bg-lime-100 px-3 py-1 text-xs font-medium text-lime-800">
              New — real-time multiplayer
            </span>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
              Find the page before everyone else
            </h1>

            <p className="mt-4 max-w-md text-lg text-zinc-600">
              A real-time multiplayer semantic guessing game. One hidden Wikipedia article, one word at a time.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="rounded-md bg-violet-700 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-800"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Log in
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Live example</p>
              <span className="rounded-full bg-lime-100 px-2.5 py-1 text-xs font-semibold text-lime-800">4/10 found</span>
            </div>
            <div className="space-y-4 px-5 py-8">
              <p className="text-base leading-8 text-zinc-700">
                {PREVIEW_WORDS.map((word, index) => (
                  <span key={`${word.label}-${index}`}>
                    {word.status === "found" ? (
                      <span className="border-b-2 border-lime-400 text-zinc-950">{word.label}</span>
                    ) : (
                      <span
                        aria-label="Hidden word"
                        className="mx-1 inline-block h-6 min-w-10 select-none rounded bg-zinc-100 align-middle text-[0]"
                      />
                    )}{" "}
                  </span>
                ))}
              </p>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-lime-500" />
                3 players guessing right now
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-20 grid w-full max-w-6xl gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="rounded-xl border border-zinc-200 bg-white p-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-700 text-sm font-semibold text-white">
                {step.number}
              </span>
              <p className="mt-4 font-semibold text-zinc-950">{step.title}</p>
              <p className="mt-1 text-sm text-zinc-500">{step.description}</p>
            </div>
          ))}
        </div>
      </section>
    </GuestOnly>
  );
}
