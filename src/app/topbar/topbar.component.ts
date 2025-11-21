import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.css'],
})
export class TopbarComponent implements OnChanges {
  @Input() showSave = false;
  @Input() navOpen = false;
  @Input() title = 'WDOC viewer';
  @Input() zoom = 100;
  @Input() hasDocument = false;
  @Output() toggleNav = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() zoomChange = new EventEmitter<number>();
  zoomValue = '100';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['zoom']) {
      this.zoomValue = `${this.zoom}`;
    }
  }

  onToggleNav() {
    this.toggleNav.emit();
  }

  onSave() {
    this.save.emit();
  }

  onZoomInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.zoomValue = value.replace(/\D+/g, '');
  }

  onZoomCommit() {
    const parsed = parseInt(this.zoomValue, 10);
    this.zoomChange.emit(Number.isFinite(parsed) ? parsed : this.zoom);
  }

  onZoomStep(delta: number) {
    this.zoomChange.emit(this.zoom + delta);
  }
}
