import { useEffect } from "react";
import { focusFirstAvailable } from "./spatialNavigation";

/** Focuses the first focusable element on the page once it has rendered.
 * Call this at the top of every page component — TV navigation needs something
 * focused at all times, and route changes reset focus to nothing. */
export function useAutoFocus(deps: unknown[] = []) {
  useEffect(() => {
    const id = requestAnimationFrame(() => focusFirstAvailable());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
