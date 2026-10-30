import type { ButtonHTMLAttributes } from "react";
import { buttonClass } from "./styles";
import type { ButtonVariant } from "./styles";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

// type defaults to "button" so a stray click never submits a form by accident.
// A form's submit button must say type='submit'.
function Button({
  variant = "primary",
  fullWidth = false,
  type = "button",
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={
        buttonClass(variant, fullWidth) + (className ? " " + className : "")
      }
      {...rest}
    />
  );
}

export default Button;
