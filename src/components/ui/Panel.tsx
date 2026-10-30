import type { ReactNode } from "react";

type PanelProps = {
  title?: string;
  description?: string;
  // Optional right-hand slot in the header, such as one outlined button.
  actions?: ReactNode;
  // Set padded={false} when the content is a table that should run edge to edge.
  padded?: boolean;
  className?: string;
  children: ReactNode;
};

// A white panel with a thin line border. No shadow.
function Panel({
  title,
  description,
  actions,
  padded = true,
  className = "",
  children,
}: PanelProps) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <section
      className={
        "rounded-panel border border-line bg-white " +
        (padded ? "" : "overflow-hidden ") +
        className
      }
    >
      {hasHeader && (
        <div
          className={
            "flex flex-wrap items-start justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5 " +
            (padded ? "" : "pb-4")
          }
        >
          <div className="min-w-0">
            {title && (
              <h2 className="font-display text-xl font-semibold text-ink">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-muted">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      <div className={padded ? "p-4 md:p-5" : ""}>{children}</div>
    </section>
  );
}

export default Panel;
