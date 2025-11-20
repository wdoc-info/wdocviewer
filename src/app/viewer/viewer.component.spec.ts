import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ViewerComponent } from './viewer.component';

describe('ViewerComponent', () => {
  let fixture: ComponentFixture<ViewerComponent>;
  let component: ViewerComponent;
  let sanitizer: DomSanitizer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ViewerComponent);
    component = fixture.componentInstance;
    sanitizer = TestBed.inject(DomSanitizer);
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
    const content: SafeHtml = sanitizer.bypassSecurityTrustHtml(
      '<wdoc-container><wdoc-page>zoom</wdoc-page></wdoc-container>'
    );
    component.htmlContent = content;
    component.zoom = 150;
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.nativeElement.querySelector('wdoc-page') as HTMLElement;
    expect(page.style.zoom).toBe('1.5');
  });
});
