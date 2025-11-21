import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TopbarComponent } from './topbar.component';

describe('TopbarComponent', () => {
  let component: TopbarComponent;
  let fixture: ComponentFixture<TopbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopbarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TopbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits toggle event when hamburger clicked', () => {
    spyOn(component.toggleNav, 'emit');
    const btn = fixture.nativeElement.querySelector('.hamburger');
    btn.click();
    expect(component.toggleNav.emit).toHaveBeenCalled();
  });

  it('emits save when save button clicked', () => {
    component.showSave = true;
    fixture.detectChanges();
    spyOn(component.save, 'emit');
    const btn = fixture.nativeElement.querySelector('.topbar-save');
    btn.click();
    expect(component.save.emit).toHaveBeenCalled();
  });

  it('renders the provided title', () => {
    component.title = 'My Document';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement.querySelector(
      '.topbar-title'
    );
    expect(el.textContent?.trim()).toBe('My Document');
  });

  it('emits zoomChange when zoom buttons are used', () => {
    component.hasDocument = true;
    spyOn(component.zoomChange, 'emit');
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.zoom-button');
    (buttons[0] as HTMLButtonElement).click();
    expect(component.zoomChange.emit).toHaveBeenCalledWith(90);
  });

  it('emits parsed zoom value from input on commit', () => {
    component.hasDocument = true;
    spyOn(component.zoomChange, 'emit');
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '.zoom-input input'
    );
    input.value = '150';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    expect(component.zoomChange.emit).toHaveBeenCalledWith(150);
  });

  it('falls back to the current zoom when an invalid value is entered', () => {
    component.hasDocument = true;
    component.zoom = 85;
    spyOn(component.zoomChange, 'emit');
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '.zoom-input input'
    );
    input.value = 'abc';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));

    expect(component.zoomChange.emit).toHaveBeenCalledWith(85);
  });
});
