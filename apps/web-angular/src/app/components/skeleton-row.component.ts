import { Component, Input } from '@angular/core';

/** Netflix-style shimmering placeholder row shown while a section's data
 * hasn't arrived yet, instead of a blank gap or a plain "Loading…" line. */
@Component({
  selector: 'app-skeleton-row',
  standalone: true,
  templateUrl: './skeleton-row.component.html',
  styleUrl: './skeleton-row.component.scss',
})
export class SkeletonRowComponent {
  @Input() cardCount = 5;

  range(): number[] {
    return Array.from({ length: this.cardCount }, (_, i) => i);
  }
}
