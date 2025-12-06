import {
  Component,
  ElementRef,
  EventEmitter,
  Output,
  Input,
  ViewChild,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Output() fileSelected = new EventEmitter<File>();
  @Output() save = new EventEmitter<void>();
  @Input() showSave = false;
  @Output() closeNav = new EventEmitter<void>();
  @Output() createNewDocument = new EventEmitter<void>();
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  isAuthModalOpen = false;
  isSettingsModalOpen = false;
  emailSent = false;
  email = '';
  statusMessage = '';
  isSubmitting = false;
  currentUserEmail: string | null = null;
  private sessionSub?: Subscription;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.currentUserEmail = this.authService.getStoredEmail();
    this.sessionSub = this.authService.session$.subscribe((session) => {
      this.currentUserEmail = session?.user?.email ?? this.authService.getStoredEmail();
    });
  }

  ngOnDestroy(): void {
    this.sessionSub?.unsubscribe();
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.fileSelected.emit(input.files[0]);
    }
  }

  triggerFileDialog() {
    this.fileInput?.nativeElement.click();
  }

  onCreateNewDocument(): void {
    this.createNewDocument.emit();
    this.closeNav.emit();
  }

  onCloseNav() {
    this.closeNav.emit();
  }

  openAuthModal() {
    if (this.currentUserEmail) {
      this.isSettingsModalOpen = true;
      return;
    }
    this.isAuthModalOpen = true;
    this.statusMessage = '';
    this.emailSent = false;
    this.email =
      this.currentUserEmail ?? this.authService.getStoredEmail() ?? '';
  }

  closeAuthModal() {
    this.isAuthModalOpen = false;
    this.isSubmitting = false;
    this.emailSent = false;
    this.statusMessage = '';
  }

  closeSettingsModal() {
    this.isSettingsModalOpen = false;
  }

  async onAuthSubmit() {
    if (!this.email) {
      this.statusMessage = 'Please enter your email to continue.';
      return;
    }
    this.emailSent = true;
    this.isSubmitting = true;
    this.statusMessage = 'Sending...';
    const { error } = await this.authService.signInWithEmail(this.email);
    this.isSubmitting = false;
    if (error) {
      this.statusMessage = error.message;
      this.emailSent = false;
      return;
    }
    this.currentUserEmail = this.email;
    this.statusMessage = 'Please check your email.';
  }

  async onLogout() {
    this.isSubmitting = true;
    await this.authService.signOut();
    this.isSubmitting = false;
    this.currentUserEmail = null;
    this.statusMessage = '';
    this.email = '';
    this.isSettingsModalOpen = false;
    this.isAuthModalOpen = false;
    this.emailSent = false;
  }
}
