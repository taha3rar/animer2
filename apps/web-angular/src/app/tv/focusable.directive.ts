import { Directive, ElementRef, HostBinding, inject } from '@angular/core';

/** Apply to a <button> or text <input> to make it a spatial-navigation target
 * (arrow keys / LG remote D-pad). Mirrors apps/web/src/tv-navigation/Focusable.tsx,
 * extended to cover inputs too — the search bar and login fields need to be
 * reachable by the D-pad, not just buttons.
 *
 * Deliberately does NOT force [type] on buttons: a HostBinding always wins over
 * a static attribute written in the host template, so binding attr.type would
 * silently turn every type="submit" button (Login, the home search bar) into
 * type="button" and break native form submission.
 *
 * The `.focusable` CSS class (the TV-style focus ring/scale) only applies to
 * buttons — inputs keep their own text-field focus styling instead. */
@Directive({
  selector: 'button[appFocusable], input[appFocusable]',
  standalone: true,
})
export class FocusableDirective {
  private el = inject(ElementRef<HTMLElement>);

  @HostBinding('attr.data-focusable') readonly dataFocusable = 'true';

  @HostBinding('class.focusable')
  get isButton(): boolean {
    return this.el.nativeElement.tagName === 'BUTTON';
  }
}
