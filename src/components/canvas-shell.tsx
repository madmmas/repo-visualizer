// Three columns, settled. Later phases fill them; they do not move.
export function CanvasShell({
  rail,
  map,
  detail,
}: {
  rail: React.ReactNode;
  map: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-[12rem_minmax(0,1fr)_16rem] grid-rows-[minmax(0,1fr)]">
      <aside
        aria-label="Categories"
        className="min-h-0 overflow-auto border-r border-border bg-surface"
      >
        {rail}
      </aside>
      <div className="h-full min-h-0 min-w-0">{map}</div>
      <aside aria-label="Details" className="min-h-0 overflow-auto border-l border-border bg-surface">
        {detail}
      </aside>
    </div>
  );
}
