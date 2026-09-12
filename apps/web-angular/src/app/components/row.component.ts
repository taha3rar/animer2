import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-row',
  standalone: true,
  templateUrl: './row.component.html',
  styleUrl: './row.component.scss',
})
export class RowComponent {
  @Input({ required: true }) title!: string;
}
