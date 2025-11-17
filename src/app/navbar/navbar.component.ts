import {
  Component,
  ElementRef,
  EventEmitter,
  Output,
  Input,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent {
  @Output() fileSelected = new EventEmitter<File>();
  @Output() save = new EventEmitter<void>();
  @Input() showSave = false;
  @Output() closeNav = new EventEmitter<void>();
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.fileSelected.emit(input.files[0]);
    }
  }

  triggerFileDialog() {
    this.fileInput?.nativeElement.click();
  }

  onCloseNav() {
    this.closeNav.emit();
  }
}
