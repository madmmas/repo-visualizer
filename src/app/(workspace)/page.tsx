import { listAnalyses } from "@/server/analyses";

export default async function WorkspacePage() {
  const result = await listAnalyses();

  return (
    <div className="px-3 py-3">
      <h1 className="text-balance text-xs text-muted">Analyses</h1>
      {"error" in result ? (
        <p className="mt-2 text-pretty text-xs" role="alert">
          {result.error}
        </p>
      ) : result.analyses.length === 0 ? (
        <p className="mt-2 text-pretty text-xs">
          This team has not run an analysis.
        </p>
      ) : (
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-1 font-normal" scope="col">
                Repository
              </th>
              <th className="w-24 py-1 font-normal" scope="col">
                State
              </th>
            </tr>
          </thead>
          <tbody>
            {result.analyses.map((analysis) => (
              <tr key={analysis.id} className="border-b border-border">
                <td className="max-w-0 truncate py-1 font-mono">
                  {analysis.repository}
                </td>
                <td className="py-1">{analysis.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
