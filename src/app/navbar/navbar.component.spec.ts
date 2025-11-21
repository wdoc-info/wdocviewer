import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let component: NavbarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
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
