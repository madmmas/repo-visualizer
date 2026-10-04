import { notFound, redirect } from "next/navigation";
import { MapSession } from "@/components/map-session";
import { getAnalysisMap } from "@/server/analyses";

export default async function AnalysisMapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) notFound();

  const map = await getAnalysisMap(id);
  if (map === null) notFound();
  if ("incomplete" in map) redirect(`/analyses/${id}`);
  if ("error" in map) {
    return (
      <p className="px-3 py-3 text-pretty text-xs" role="alert">
        {map.error}
      </p>
    );
  }

  const rootName = map.repository.split("/").filter(Boolean).pop() ?? map.repository;

  return (
    <MapSession
      files={map.files}
      edges={map.edges}
      rootName={rootName}
      framework={map.adapter}
      imports={map.imports}
      routes={0}
      coveragePercent={map.coveragePercent}
    />
  );
}
