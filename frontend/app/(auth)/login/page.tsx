import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Connexion",
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-950">Connexion</h1>

      <form className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="nom@exemple.com"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-sm font-medium text-zinc-700">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-violet-700 py-2 text-sm font-medium text-white"
        >
          Se connecter
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-500">
        Pas encore de compte ?{" "}
        <Link href="/register" className="font-medium text-violet-700">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}