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
      <p className="mt-2 text-sm text-zinc-500">Last updated: August 28, 2026</p>

      <div className="mt-8 space-y-8 text-zinc-700">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            1. Data we collect
          </h2>
          <p className="mt-2">
            To create an account and play on Transcendix, we collect your
            email address, a username, a password (stored only in hashed
            form, never in plain text) and, if you add one, an avatar. While
            you play, we record your game statistics (wins, losses, time
            played, number of hints used), your match history, as well as
            the messages you send in chat.
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
            When you request a hint during a match, the text of the article
            to guess (never your identity or account data) is sent to a
            third-party artificial intelligence provider to generate the
            hint. We do not sell or share your personal data for advertising
            purposes.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            4. Retention and deletion
          </h2>
          <p className="mt-2">
            Your data is kept for as long as your account is active. You can
            request deletion of your account and associated data at any time
            from your settings, or by contacting us.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            5. Your rights
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
