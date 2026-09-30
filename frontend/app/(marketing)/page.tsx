import type { Metadata } from "next";
import { GuestOnly } from "@/components/guest-only";
import { LandingContent } from "@/components/landing-content";

export const metadata: Metadata = {
  title: "Transcendix — find the article first",
};

export default function LandingPage() {
  return (
    <GuestOnly>
      <LandingContent />
    </GuestOnly>
  );
}
