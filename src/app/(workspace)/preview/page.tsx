import path from "node:path";
import { MapSession } from "@/components/map-session";
import { readResult } from "@/parser/result";

export default function PreviewPage() {
  const result = readResult(path.join(process.cwd(), "data/preview.json"));
  const rootName = path.basename(result.root);

  return (
    <MapSession
      files={result.files}
      edges={result.edges}
      rootName={rootName}
      framework={result.adapter}
      imports={result.imports.length}
      // The stored result has no routes. The fallback adapter recovered none.
      routes={0}
    />
  );
}
