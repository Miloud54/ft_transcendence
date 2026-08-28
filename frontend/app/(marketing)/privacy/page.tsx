import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
};

export default function PrivacyPage() {
  return (
    <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold text-zinc-950">
        Politique de confidentialité
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Dernière mise à jour : 28 août 2026</p>

      <div className="mt-8 space-y-8 text-zinc-700">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            1. Données que nous collectons
          </h2>
          <p className="mt-2">
            Pour créer un compte et jouer sur Transcendix, nous collectons votre
            adresse email, un nom d&apos;utilisateur, un mot de passe (stocké
            uniquement sous forme hachée, jamais en clair) et, si vous en
            ajoutez un, un avatar. Pendant que vous jouez, nous enregistrons
            vos statistiques de partie (victoires, défaites, temps de jeu,
            nombre d&apos;indices utilisés), l&apos;historique de vos parties,
            ainsi que les messages que vous envoyez dans le chat.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            2. Pourquoi nous les collectons
          </h2>
          <p className="mt-2">
            Ces données sont nécessaires au fonctionnement du jeu :
            authentification, synchronisation des parties en temps réel entre
            joueurs, calcul des classements et de vos statistiques
            personnelles, et affichage de votre profil aux autres joueurs
            (nom d&apos;utilisateur, avatar, statut en ligne).
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            3. Partage avec des tiers
          </h2>
          <p className="mt-2">
            Lorsque vous demandez un indice en cours de partie, le texte de
            l&apos;article à deviner (jamais votre identité ni vos données de
            compte) est envoyé à un fournisseur d&apos;intelligence
            artificielle tiers afin de générer l&apos;indice. Nous ne vendons
            ni ne partageons vos données personnelles à des fins publicitaires.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            4. Conservation et suppression
          </h2>
          <p className="mt-2">
            Vos données sont conservées tant que votre compte est actif. Vous
            pouvez demander la suppression de votre compte et des données
            associées à tout moment depuis vos paramètres, ou en nous
            contactant.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            5. Vos droits
          </h2>
          <p className="mt-2">
            Vous pouvez demander l&apos;accès, la rectification ou la
            suppression de vos données personnelles à tout moment.
          </p>
        </div>
      </div>
    </section>
  );
}