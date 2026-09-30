import type { Metadata } from "next";
import { HomeContent } from "@/components/home-content";

export const metadata: Metadata = {
  title: "Home",
};

export default function DashboardPage() {
  return <HomeContent />;
}
