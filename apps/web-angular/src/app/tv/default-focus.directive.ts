import { Directive, HostBinding, Input } from '@angular/core';

/** Marks the element spatial nav should land on when nothing is focused yet
 * and the user presses an arrow key for the first time (see the fallback
 * path in `focusFirstAvailable`, spatial-navigation.ts). Purely passive — it
 * does NOT grab focus on its own, so the screen loads with no focus ring
 * until the user actually reaches for the D-pad/arrow keys.
 *
 * Bare `appDefaultFocus` is always-on. Bind it (`[appDefaultFocus]="expr"`)
 * when which element should hold the marker changes with state — e.g. the
 * player's Back button while loading, handing off to the Play button once
 * it exists — so exactly one element is marked at a time. */
@Directive({
  selector: '[appDefaultFocus]',
  standalone: true,
})
export class DefaultFocusDirective {
  @Input('appDefaultFocus') enabled: boolean | '' = true;

  @HostBinding('attr.data-default-focus')
  get marker(): string | null {
    return this.enabled || this.enabled === '' ? 'true' : null;
  }
}
