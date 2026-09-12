// Minimal spatial navigation for D-pad/remote input (LG remote, keyboard arrows).
// Ported verbatim from apps/web/src/tv-navigation/spatialNavigation.ts — it's
// plain DOM, no framework dependency, so the logic is identical here.

export type Direction = 'up' | 'down' | 'left' | 'right';

export function getFocusableElements(): HTMLElement[] {
  // When a modal is open (tags its root with [data-modal-root]), scope
  // navigation to it — otherwise the D-pad can "reach through" the modal into
  // background content that's only visually, not structurally, covered.
  const scope = document.querySelector<HTMLElement>('[data-modal-root]') ?? document;
  return Array.from(scope.querySelectorAll<HTMLElement>('[data-focusable="true"]')).filter(
    (el) => el.offsetParent !== null && !el.hasAttribute('disabled')
  );
}

export function findNextFocusTarget(current: HTMLElement, direction: Direction): HTMLElement | null {
  const currentRect = current.getBoundingClientRect();
  const currentCenterX = currentRect.left + currentRect.width / 2;
  const currentCenterY = currentRect.top + currentRect.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of getFocusableElements()) {
    if (el === current) continue;
    const rect = el.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - currentCenterX;
    const dy = rect.top + rect.height / 2 - currentCenterY;

    let primary: number;
    let cross: number;

    if (direction === 'up') {
      if (dy >= -1) continue;
      primary = -dy;
      cross = Math.abs(dx);
    } else if (direction === 'down') {
      if (dy <= 1) continue;
      primary = dy;
      cross = Math.abs(dx);
    } else if (direction === 'left') {
      if (dx >= -1) continue;
      primary = -dx;
      cross = Math.abs(dy);
    } else {
      if (dx <= 1) continue;
      primary = dx;
      cross = Math.abs(dy);
    }

    // Weight lateral offset more heavily so same-row/column neighbors win over
    // diagonally-closer elements — this is what makes grid navigation feel right.
    const score = primary + cross * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

export function focusFirstAvailable(): void {
  const elements = getFocusableElements();
  const marked = elements.find((el) => el.hasAttribute('data-default-focus'));
  (marked ?? elements[0])?.focus();
}
