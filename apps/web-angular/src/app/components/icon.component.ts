import { Component, Input } from '@angular/core';

export type IconName =
  | 'arrow-left'
  | 'play'
  | 'pause'
  | 'skip-back'
  | 'skip-forward'
  | 'fast-forward'
  | 'captions'
  | 'heart'
  | 'heart-filled'
  | 'x'
  | 'check'
  | 'film'
  | 'search'
  | 'refresh';

/** Small inline-SVG icon set (Lucide-style: 24x24, round caps/joins) so the UI
 * doesn't rely on emoji glyphs, which render inconsistently across platforms/fonts. */
@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg
      class="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name) {
        @case ('arrow-left') {
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        }
        @case ('play') {
          <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none" />
        }
        @case ('pause') {
          <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
          <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
        }
        @case ('skip-back') {
          <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none" />
          <rect x="4" y="4" width="2" height="16" rx="1" fill="currentColor" stroke="none" />
        }
        @case ('skip-forward') {
          <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" />
          <rect x="18" y="4" width="2" height="16" rx="1" fill="currentColor" stroke="none" />
        }
        @case ('fast-forward') {
          <polygon points="13 19 22 12 13 5 13 19" fill="currentColor" stroke="none" />
          <polygon points="2 19 11 12 2 5 2 19" fill="currentColor" stroke="none" />
        }
        @case ('captions') {
          <rect width="18" height="14" x="3" y="5" rx="2" />
          <path d="M7 11h2M13 11h4M7 15h4M15 15h2" />
        }
        @case ('heart') {
          <path
            d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.05 3 5.5l7 7Z"
          />
        }
        @case ('heart-filled') {
          <path
            d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.05 3 5.5l7 7Z"
            fill="currentColor"
          />
        }
        @case ('x') {
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        }
        @case ('check') {
          <path d="M20 6 9 17l-5-5" />
        }
        @case ('film') {
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M7 3v18M17 3v18M3 7.5h4M17 7.5h4M3 12h18M3 16.5h4M17 16.5h4" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        }
        @case ('refresh') {
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 16h5v5" />
        }
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1em;
        height: 1em;
      }
      .icon {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class IconComponent {
  @Input({ required: true }) name!: IconName;
}
