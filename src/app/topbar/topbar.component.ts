import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.css'],
})
export class TopbarComponent {
  @Input() showSave = false;
  @Input() navOpen = false;
  @Output() toggleNav = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();

  onToggleNav() {
    this.toggleNav.emit();
  }

  onSave() {
    this.save.emit();
  }
}
