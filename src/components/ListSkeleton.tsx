type Props = {
  rows?: number;
};

function ListSkeleton({ rows = 4 }: Props) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-white"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-3 px-4 py-4"
        >
          <div className="size-10 shrink-0 rounded-full bg-line" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 rounded bg-line" />
            <div className="h-3 w-1/3 rounded bg-line" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export default ListSkeleton;
