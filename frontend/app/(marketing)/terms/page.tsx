import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
};

export default function TermsPage() {
  return (
    <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold text-zinc-950">
        Conditions d&apos;utilisation
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Dernière mise à jour : 28 août 2026</p>

      <div className="mt-8 space-y-8 text-zinc-700">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            1. Objet
          </h2>
          <p className="mt-2">
            Transcendix est un jeu multijoueur en temps réel dans lequel
            plusieurs joueurs s&apos;affrontent pour retrouver une page
            Wikipédia cachée à partir de propositions de mots, assistés par des
            indices générés par une intelligence artificielle. L&apos;usage du
            service implique l&apos;acceptation des présentes conditions.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            2. Compte utilisateur
          </h2>
          <p className="mt-2">
            Vous devez fournir des informations exactes lors de votre
            inscription et êtes responsable de la confidentialité de votre
            mot de passe. Un compte est strictement personnel et ne doit pas
            être partagé.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            3. Règles de jeu et comportement
          </h2>
          <p className="mt-2">
            Il est interdit d&apos;utiliser des scripts, bots ou tout moyen
            automatisé pour jouer à votre place ou fausser les classements. Les
            messages envoyés dans le chat doivent rester respectueux ; tout
            contenu injurieux, discriminatoire ou de harcèlement peut entraîner
            une suspension de compte.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            4. Disponibilité du service
          </h2>
          <p className="mt-2">
            Transcendix est fourni dans le cadre d&apos;un projet pédagogique.
            Le service est fourni &quot;en l&apos;état&quot;, sans garantie de
            disponibilité continue.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            5. Modification des conditions
          </h2>
          <p className="mt-2">
            Ces conditions peuvent être mises à jour ; la date de dernière
            modification en haut de cette page sera actualisée en
            conséquence.
          </p>
        </div>
      </div>
    </section>
  );
}