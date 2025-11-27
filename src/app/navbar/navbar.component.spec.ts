import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { NavbarComponent } from './navbar.component';
import { AuthService } from '../services/auth.service';

class MockAuthService {
  private sessionSubject = new BehaviorSubject(null);
  session$ = this.sessionSubject.asObservable();
  getStoredEmail = jasmine.createSpy('getStoredEmail').and.returnValue(null);
  signInWithEmail = jasmine
    .createSpy('signInWithEmail')
    .and.returnValue(Promise.resolve({ error: null }));
  signOut = jasmine
    .createSpy('signOut')
    .and.returnValue(Promise.resolve({ error: null }));
}

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let component: NavbarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [{ provide: AuthService, useClass: MockAuthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
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
});
