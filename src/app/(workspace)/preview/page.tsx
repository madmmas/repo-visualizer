import path from "node:path";
import { CanvasShell } from "@/components/canvas-shell";
import { CategoryRail } from "@/components/category-rail";
import { MapCanvas } from "@/components/map-canvas";
import { categoriesOf } from "@/map/categories";
import { readResult } from "@/parser/result";

export default function PreviewPage() {
  const result = readResult(path.join(process.cwd(), "data/preview.json"));
  const rootName = path.basename(result.root);

  return (
    <CanvasShell
      rail={<CategoryRail categories={categoriesOf(result.files)} />}
      map={<MapCanvas files={result.files} edges={result.edges} rootName={rootName} />}
      detail={null}
    />
  );
}
