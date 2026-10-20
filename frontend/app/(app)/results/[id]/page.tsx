import type { Metadata } from "next";
import { ResultsContent } from "./results-content";

export const metadata: Metadata = {
  title: "Results",
};

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResultsContent gameId={id} />;
}
