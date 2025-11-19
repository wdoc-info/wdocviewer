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
});
