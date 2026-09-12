import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type FocusableProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** A plain <button> tagged for spatial navigation. Using a real button means
 * Enter/Space activation and the click event come from the browser for free. */
export const Focusable = forwardRef<HTMLButtonElement, FocusableProps>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      data-focusable="true"
      className={["focusable", className].filter(Boolean).join(" ")}
      {...props}
    />
  )
);
Focusable.displayName = "Focusable";
