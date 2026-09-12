import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { AnizoneSearchItem } from '@streaming/types';
import { FocusableDirective } from '../tv/focusable.directive';

@Component({
  selector: 'app-anizone-result-card',
  standalone: true,
  imports: [FocusableDirective],
  templateUrl: './anizone-result-card.component.html',
  styleUrl: './anizone-result-card.component.scss',
})
export class AnizoneResultCardComponent {
  @Input({ required: true }) item!: AnizoneSearchItem;
  @Input() isInLibrary = false;
  @Output() cardClick = new EventEmitter<void>();

  meta(): string {
    return [this.item.type, this.item.startYear].filter(Boolean).join(' · ');
  }
}
