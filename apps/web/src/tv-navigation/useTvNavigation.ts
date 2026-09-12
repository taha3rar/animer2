import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { findNextFocusTarget, focusFirstAvailable, type Direction } from "./spatialNavigation";

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// LG remote "Back" key fires a keydown with key "GoBack" (or keyCode 461) inside the
// webOS runtime; plain browsers/keyboards use Backspace/Escape during dev.
const BACK_KEYS = new Set(["GoBack", "Backspace", "Escape"]);

/** Mount once near the app root. Wires the remote/keyboard D-pad to spatial focus
 * movement and the Back key to router history, everywhere in the app. */
export function useTvNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const active = document.activeElement as HTMLElement | null;
      const isTypingTarget = active?.tagName === "INPUT" || active?.tagName === "TEXTAREA";

      const direction = KEY_TO_DIRECTION[e.key];
      if (direction && !isTypingTarget) {
        e.preventDefault();
        if (active && active.getAttribute("data-focusable") === "true") {
          const next = findNextFocusTarget(active, direction);
          next?.focus();
        } else {
          focusFirstAvailable();
        }
        return;
      }

      if (BACK_KEYS.has(e.key) && !isTypingTarget) {
        e.preventDefault();
        navigate(-1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);
}
