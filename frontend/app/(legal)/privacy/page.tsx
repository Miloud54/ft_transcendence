import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold text-zinc-950">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: October 28, 2026</p>

      <div className="mt-8 space-y-8 text-zinc-700">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            1. Data we collect
          </h2>
          <p className="mt-2">
            To create an account and play on Transcendix, we collect your
            email address, a username and a password (stored only as a salted
            hash, never in plain text). If you sign in with Google or
            Discord, we store the identifier of that account instead of a
            password. You can also upload an avatar. While you play, we
            record your game results (score, rank, win or loss), your match
            history, your experience points and level, your friends list and your online status.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            2. Why we collect it
          </h2>
          <p className="mt-2">
            This data is necessary for the game to work: authentication,
            real-time synchronization of matches between players,
            calculating leaderboards and your personal statistics, and
            displaying your profile to other players (username, avatar,
            online status).
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            3. Sharing with third parties
          </h2>
          <p className="mt-2">
            We do not sell or share your personal data for advertising
            purposes. A few external services are involved in running the
            game: Google and Discord, only if you choose to sign in with
            them; DiceBear, which serves the default avatar images displayed
            in your browser; and Wikipedia, from which the game articles are
            retrieved (no user data is sent to Wikipedia).
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            4. Retention and deletion
          </h2>
          <p className="mt-2">
            Your account data is kept for as long as your account exists.
            Chat messages are not stored in our database: they are kept in
            memory for the duration of a room session only and are lost when
            the server restarts. Technical logs, which may contain your IP
            address, are kept for 30 days for security and debugging
            purposes. You can request the deletion of your account and
            associated data at any time by contacting us.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            5. Cookies and local storage
          </h2>
          <p className="mt-2">
            Transcendix does not use advertising or tracking cookies. Your
            session tokens are stored in your browser&apos;s local storage so
            that you stay signed in, and are removed when you log out.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            6. Your rights
          </h2>
          <p className="mt-2">
            You can request access to, correction of, or deletion of your
            personal data at any time.
          </p>
        </div>
      </div>
    </section>
  );
}
