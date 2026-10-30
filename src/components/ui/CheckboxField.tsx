import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";

type CheckboxFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: ReactNode;
  error?: string;
};

// The whole row is the tap target (44px tall), and the label is tied to the box.
function CheckboxField({
  label,
  error,
  id,
  className = "",
  ...rest
}: CheckboxFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div>
      <label
        htmlFor={fieldId}
        className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-[15px] text-ink"
      >
        <input
          id={fieldId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? fieldId + "-error" : undefined}
          className={
            "mt-0.5 size-5 shrink-0 accent-brand" +
            (className ? " " + className : "")
          }
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p
          id={fieldId + "-error"}
          role="alert"
          className="mt-1 flex items-start gap-1.5 text-[13px] font-semibold text-danger"
        >
          <WarningCircle
            size={16}
            aria-hidden="true"
            className="mt-px shrink-0"
          />
          {error}
        </p>
      )}
    </div>
  );
}

export default CheckboxField;
