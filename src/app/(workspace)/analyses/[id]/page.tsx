import { notFound, redirect } from "next/navigation";
import { AnalysisProgressView } from "@/components/analysis-progress";
import { getAnalysis } from "@/server/analyses";

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) notFound();

  const analysis = await getAnalysis(id);
  if (analysis === null) notFound();
  if ("error" in analysis) {
    return (
      <p className="px-3 py-3 text-pretty text-xs" role="alert">
        {analysis.error}
      </p>
    );
  }
  if (analysis.state === "complete") redirect(`/analyses/${id}/map`);

  return <AnalysisProgressView analysis={analysis} />;
}
