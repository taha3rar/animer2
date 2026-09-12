import {
  Directive,
  ElementRef,
  AfterViewInit,
  HostBinding,
  inject,
} from '@angular/core';

@Directive({
  selector: 'button[appFocusOnSpawn]',
  standalone: true,
})
export class FocusOnSpawnDirective implements AfterViewInit {
  constructor(private el: ElementRef<HTMLElement>) {}

  @HostBinding('attr.data-focusable') readonly dataFocusable = 'true';

  @HostBinding('class.focusable')
  get isButton(): boolean {
    return this.el.nativeElement.tagName === 'BUTTON';
  }

  ngAfterViewInit(): void {
    requestAnimationFrame(() => this.el.nativeElement.focus());
  }
}
