import { useId } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { inputClass, textAreaClass } from "./styles";

type FieldMeta = {
  label: string;
  hint?: string;
  error?: string;
};

function describedBy(
  id: string,
  hint?: string,
  error?: string,
): string | undefined {
  const ids: string[] = [];
  if (hint) ids.push(id + "-hint");
  if (error) ids.push(id + "-error");
  return ids.length > 0 ? ids.join(" ") : undefined;
}

type ShellProps = FieldMeta & {
  id: string;
  children: ReactNode;
};

// Real <label> tied to the control, an optional hint, and an error that carries
// an icon and words, so colour is never the only signal.
function FieldShell({ id, label, hint, error, children }: ShellProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[15px] font-semibold text-ink"
      >
        {label}
      </label>
      {children}
      {hint && (
        <p id={id + "-hint"} className="mt-1.5 text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={id + "-error"}
          role="alert"
          className="mt-1.5 flex items-start gap-1.5 text-[13px] font-semibold text-danger"
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

type TextFieldProps = FieldMeta & InputHTMLAttributes<HTMLInputElement>;

export function TextField({
  label,
  hint,
  error,
  id,
  className = "",
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={
          inputClass(Boolean(error)) + (className ? " " + className : "")
        }
        {...rest}
      />
    </FieldShell>
  );
}

type TextAreaFieldProps = FieldMeta &
  TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextAreaField({
  label,
  hint,
  error,
  id,
  className = "",
  ...rest
}: TextAreaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <textarea
        id={fieldId}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={
          textAreaClass(Boolean(error)) + (className ? " " + className : "")
        }
        {...rest}
      />
    </FieldShell>
  );
}

type SelectFieldProps = FieldMeta & SelectHTMLAttributes<HTMLSelectElement>;

export function SelectField({
  label,
  hint,
  error,
  id,
  className = "",
  children,
  ...rest
}: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={
          inputClass(Boolean(error)) + (className ? " " + className : "")
        }
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}
