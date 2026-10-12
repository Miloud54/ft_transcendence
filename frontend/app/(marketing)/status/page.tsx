import type { Metadata } from "next";
import { StatusContent } from "@/components/status-content";

export const metadata: Metadata = {
  title: "System Status",
};

export default function StatusPage() {
  return <StatusContent />;
}
