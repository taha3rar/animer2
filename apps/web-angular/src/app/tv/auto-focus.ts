import { focusFirstAvailable } from './spatial-navigation';

/** Call from a page component's ngAfterViewInit (and again whenever the data it
 * renders arrives) — mirrors apps/web/src/tv-navigation/useAutoFocus.ts. TV
 * navigation needs something focused at all times, and route changes/async
 * data reset focus to nothing. */
export function autoFocus(): void {
  requestAnimationFrame(() => focusFirstAvailable());
}
