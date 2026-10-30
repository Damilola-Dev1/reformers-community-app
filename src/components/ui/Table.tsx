import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

type TableProps = {
  // Read out by screen readers. Not shown on screen.
  caption: string;
  children: ReactNode;
};

// Real <table> markup. On a narrow screen the table scrolls sideways
// instead of squashing its columns.
export function Table({ caption, children }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-[15px] text-ink">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({
  className = "",
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={
        "border-b border-line bg-cream px-4 py-3 text-[13px] font-semibold tracking-wide text-muted uppercase " +
        className
      }
      {...rest}
    />
  );
}

export function Td({
  className = "",
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={"border-b border-line px-4 py-3 align-middle " + className}
      {...rest}
    />
  );
}

type TrProps = HTMLAttributes<HTMLTableRowElement> & {
  // Tints the row, for example a member who is waiting for approval.
  tinted?: boolean;
};

export function Tr({ tinted = false, className = "", ...rest }: TrProps) {
  return (
    <tr
      className={
        (tinted ? "bg-brand-tint " : "") +
        "[&:last-child>td]:border-b-0 " +
        className
      }
      {...rest}
    />
  );
}
