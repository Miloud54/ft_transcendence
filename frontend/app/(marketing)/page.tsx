import type { Metadata } from "next";
import { LandingContent } from "@/components/landing-content";

export const metadata: Metadata = {
  title: "Transcendix — find the article first",
};

export default function LandingPage() {
  return <LandingContent />;
}
