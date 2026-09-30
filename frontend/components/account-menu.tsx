"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { useCurrentUser } from "@/lib/current-user-context";

const AVATAR_SEEDS = ["Nova", "Comet", "Pixel", "Blaze", "Echo", "Juno", "Astra", "Rex", "Luna", "Zephyr"];

function avatarUrl(seed: string) {
  return `https://api.dicebear.com/10.x/critters/svg?seed=${seed}`;
}

function seedFromAvatarUrl(url: string) {
  const match = url.match(/seed=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function AccountMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [seedIndex, setSeedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleClose = useCallback(() => setIsOpen(false), []);

  const { user, setUser } = useCurrentUser();
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
    setIsOpen(false);
    router.push("/");
  }

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen && user) {
      setUsername(user.username);
      const currentSeed = seedFromAvatarUrl(user.avatar);
      const index = currentSeed ? AVATAR_SEEDS.indexOf(currentSeed) : -1;
      setSeedIndex(index >= 0 ? index : 0);
    }
  }

  function cycleAvatar(direction: 1 | -1) {
    setSeedIndex((current) => (current + direction + AVATAR_SEEDS.length) % AVATAR_SEEDS.length);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch("http://localhost:3001/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username, avatar: avatarUrl(AVATAR_SEEDS[seedIndex]) }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(Array.isArray(data.message) ? data.message.join(", ") : data.message);
        return;
      }

      setUser(data);
      setSuccess(true);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Account settings"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-200 text-zinc-500 hover:bg-zinc-50"
      >
        ⚙
      </button>

      <Modal isOpen={isOpen} onClose={handleClose} title="Account settings">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm font-medium text-zinc-700">Avatar</p>
            <div className="mt-2 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => cycleAvatar(-1)}
                aria-label="Previous avatar"
                className="rounded-full border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50"
              >
                ‹
              </button>
              <img
                src={avatarUrl(AVATAR_SEEDS[seedIndex])}
                alt="Selected avatar"
                className="h-20 w-20 rounded-full bg-zinc-100"
              />
              <button
                type="button"
                onClick={() => cycleAvatar(1)}
                aria-label="Next avatar"
                className="rounded-full border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50"
              >
                ›
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="account-username" className="text-sm font-medium text-zinc-700">
              Username
            </label>
            <input
              id="account-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={3}
              maxLength={30}
              required
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-[#d03b3b]">{error}</p>}
          {success && <p className="text-sm text-[#0ca30c]">Saved.</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-violet-700 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Save changes"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-md border border-zinc-300 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Log out
        </button>
      </Modal>
    </>
  );
}
