import { listAnalyses } from "@/server/analyses";
import { AnalyseForm } from "@/components/analyse-form";
import { AnalysisTable } from "@/components/analysis-table";

export default async function WorkspacePage() {
  const result = await listAnalyses();

  return (
    <div className="px-3 py-3">
      <h1 className="text-balance text-xs text-muted">Analyses</h1>
      <AnalyseForm />
      {"error" in result ? (
        <p className="mt-2 text-pretty text-xs" role="alert">
          {result.error}
        </p>
      ) : (
        <AnalysisTable analyses={result.analyses} />
      )}
    </div>
  );
}
