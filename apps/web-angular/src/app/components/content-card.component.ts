import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FocusableDirective } from '../tv/focusable.directive';

@Component({
  selector: 'app-content-card',
  standalone: true,
  imports: [FocusableDirective],
  templateUrl: './content-card.component.html',
  styleUrl: './content-card.component.scss',
})
export class ContentCardComponent {
  @Input({ required: true }) title!: string;
  @Input() imageUrl?: string | null;
  @Input() progressRatio?: number;
  @Input() episodeTag?: string;
  @Output() cardClick = new EventEmitter<void>();

  clampedProgress(): number {
    return Math.min(100, Math.max(0, (this.progressRatio ?? 0) * 100));
  }
}
