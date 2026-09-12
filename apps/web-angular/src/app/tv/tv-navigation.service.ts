import { Injectable, NgZone, inject } from '@angular/core';
import { Location } from '@angular/common';
import { findNextFocusTarget, focusFirstAvailable, type Direction } from './spatial-navigation';

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

// LG remote "Back" key fires a keydown with key "GoBack" inside the webOS
// runtime; plain browsers/keyboards use Backspace/Escape during dev.
export const BACK_KEYS = new Set(['GoBack', 'Backspace', 'Escape']);

/** Mirrors apps/web/src/tv-navigation/useTvNavigation.ts. Started once from
 * AppComponent — wires the remote/keyboard D-pad to spatial focus movement and
 * the Back key to browser history, everywhere in the app. */
@Injectable({ providedIn: 'root' })
export class TvNavigationService {
  private location = inject(Location);
  private zone = inject(NgZone);
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.zone.runOutsideAngular(() => {
      window.addEventListener('keydown', this.onKeyDown);
    });
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const active = document.activeElement as HTMLElement | null;
    const isTypingTarget = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA';

    const direction = KEY_TO_DIRECTION[e.key];
    // Inside a text field, Left/Right must stay native (move the text cursor) or
    // you could never edit past the first/last character. Up/Down have no such
    // meaning in a single-line input, so they're free to drive spatial nav —
    // that's the escape hatch out of the search bar/login fields via the D-pad.
    const suppressForTyping = isTypingTarget && (direction === 'left' || direction === 'right');

    if (direction && !suppressForTyping) {
      e.preventDefault();
      if (active && active.getAttribute('data-focusable') === 'true') {
        const next = findNextFocusTarget(active, direction);
        next?.focus();
      } else {
        focusFirstAvailable();
      }
      return;
    }

    if (BACK_KEYS.has(e.key) && !isTypingTarget) {
      e.preventDefault();
      this.zone.run(() => this.location.back());
    }
  };
}
