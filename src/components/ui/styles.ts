// src/components/ui/styles.ts
// Class strings shared by the UI components. They are exported so a router
// <Link> or an <a> can look exactly like a button: <Link className={buttonClass('outline')}>.

export type ButtonVariant = "primary" | "outline" | "quiet" | "danger";

// One size only: every button and link-button is at least 44px tall.
const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-[15px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";

const buttonVariants: Record<ButtonVariant, string> = {
  // The one filled action on a screen.
  primary: "bg-brand text-white hover:bg-brand-dark",
  // Row actions and secondary actions.
  outline: "border border-brand bg-white text-brand hover:bg-brand-tint",
  // Text-only action, for the quietest row actions.
  quiet: "text-brand hover:bg-brand-tint",
  // Destructive actions, drawn as an outline so they are never the loudest thing on screen.
  danger: "border border-danger bg-white text-danger hover:bg-danger-bg",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  fullWidth = false,
): string {
  return (
    buttonBase + " " + buttonVariants[variant] + (fullWidth ? " w-full" : "")
  );
}

// 16px text so phones do not zoom in when a field gets focus.
const fieldBase =
  "block w-full rounded-control border bg-white px-3 py-2 text-base text-ink placeholder:text-muted focus:border-brand";

function fieldBorder(invalid: boolean): string {
  return invalid ? "border-danger" : "border-line";
}

export function inputClass(invalid = false): string {
  return fieldBase + " min-h-11 " + fieldBorder(invalid);
}

export function textAreaClass(invalid = false): string {
  return fieldBase + " min-h-28 resize-y " + fieldBorder(invalid);
}
