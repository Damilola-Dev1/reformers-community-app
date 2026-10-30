import type { ReactNode } from "react";
import { CheckCircle, Warning, XCircle } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

// success, warning and danger are for STATUS only. Use neutral for anything else
// (a role, a count, a label). Every chip carries words, and the status tones
// also carry an icon, so colour is never the only signal.
export type ChipTone = "success" | "warning" | "danger" | "neutral";

const toneClass: Record<ChipTone, string> = {
  success: "bg-ok-bg text-ok",
  warning: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  neutral: "border border-line bg-cream text-muted",
};

const toneIcon: Record<ChipTone, Icon | null> = {
  success: CheckCircle,
  warning: Warning,
  danger: XCircle,
  neutral: null,
};

type ChipProps = {
  tone?: ChipTone;
  // Leave out for the tone's default icon. Pass null for no icon.
  icon?: Icon | null;
  children: ReactNode;
};

function Chip({ tone = "neutral", icon, children }: ChipProps) {
  const Glyph = icon === undefined ? toneIcon[tone] : icon;
  return (
    <span
      className={
        "inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap " +
        toneClass[tone]
      }
    >
      {Glyph && <Glyph size={14} aria-hidden="true" />}
      {children}
    </span>
  );
}

export default Chip;
