import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ViewerComponent } from './viewer.component';

describe('ViewerComponent', () => {
  let fixture: ComponentFixture<ViewerComponent>;
  let component: ViewerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ViewerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render html content', () => {
    component.htmlContent = '<p>hello</p>' as any;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('hello');
  });

  it('applies zoom to the content container', async () => {
    component.htmlContent = '<p>zoom</p>' as any;
    component.zoom = 150;
    fixture.detectChanges();
    await fixture.whenStable();
    const content = fixture.nativeElement.querySelector(
      '.viewer-content'
    ) as HTMLElement;
    expect(content.style.transform).toContain('1.5');
  });
});
