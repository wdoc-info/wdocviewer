import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { NavbarComponent } from './navbar.component';
import { AuthService } from '../services/auth.service';

class MockAuthService {
  private sessionSubject = new BehaviorSubject<any>(null);
  session$ = this.sessionSubject.asObservable();
  getStoredEmail = jasmine.createSpy('getStoredEmail').and.returnValue(null);
  signInWithEmail = jasmine
    .createSpy('signInWithEmail')
    .and.callFake(() => Promise.resolve({ error: null }));
  signOut = jasmine
    .createSpy('signOut')
    .and.callFake(() => Promise.resolve({ error: null }));

  emitSession(session: unknown) {
    this.sessionSubject.next(session);
  }
}

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let component: NavbarComponent;
  let authService: MockAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [{ provide: AuthService, useClass: MockAuthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as unknown as MockAuthService;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit selected file', () => {
    const file = new File(['dummy'], 'test.zip');
    let emitted: File | null = null;
    component.fileSelected.subscribe((f) => (emitted = f));

    const mockEvent = { target: { files: [file] } } as unknown as Event;
    component.onFileChange(mockEvent);

    expect(emitted).toBeTruthy();
    expect(emitted!.name).toBe('test.zip');
  });

  it('should open auth modal with stored email and clear status', () => {
    authService.getStoredEmail.and.returnValue('stored@example.com');
    component.openAuthModal();

    expect(component.isAuthModalOpen).toBeTrue();
    expect(component.email).toBe('stored@example.com');
    expect(component.statusMessage).toBe('');
    expect(component.emailSent).toBeFalse();
  });

  it('should open settings modal when user already logged in', () => {
    component.currentUserEmail = 'user@example.com';

    component.openAuthModal();

    expect(component.isSettingsModalOpen).toBeTrue();
    expect(component.isAuthModalOpen).toBeFalse();
  });

  it('should show validation message when no email provided', async () => {
    component.email = '';
    await component.onAuthSubmit();

    expect(component.statusMessage).toContain('Please enter your email');
    expect(authService.signInWithEmail).not.toHaveBeenCalled();
    expect(component.isSubmitting).toBeFalse();
  });

  it('should display error when sign in fails', async () => {
    const error = { message: 'failed' };
    authService.signInWithEmail.and.returnValue(Promise.resolve({ error } as any));
    component.email = 'user@example.com';

    await component.onAuthSubmit();

    expect(authService.signInWithEmail).toHaveBeenCalledWith('user@example.com');
    expect(component.statusMessage).toBe('failed');
    expect(component.currentUserEmail).toBeNull();
    expect(component.isSubmitting).toBeFalse();
  });

  it('should set status when sign in succeeds and hide input', async () => {
    component.email = 'user@example.com';

    await component.onAuthSubmit();

    expect(authService.signInWithEmail).toHaveBeenCalledWith('user@example.com');
    expect(component.statusMessage).toContain('Please check your email');
    expect(component.currentUserEmail).toBe('user@example.com');
    expect(component.isSubmitting).toBeFalse();
    expect(component.emailSent).toBeTrue();
  });

  it('should clear auth state on logout', async () => {
    component.currentUserEmail = 'user@example.com';
    component.isSettingsModalOpen = true;

    await component.onLogout();

    expect(authService.signOut).toHaveBeenCalled();
    expect(component.currentUserEmail).toBeNull();
    expect(component.statusMessage).toBe('');
    expect(component.isSubmitting).toBeFalse();
    expect(component.isSettingsModalOpen).toBeFalse();
  });

  it('should update current user when session changes', () => {
    authService.emitSession({ user: { email: 'session@example.com' } } as any);
    expect(component.currentUserEmail).toBe('session@example.com');
  });
});
