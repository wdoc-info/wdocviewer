import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
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
    const host = fixture.nativeElement.querySelector(
      '.viewer-shadow-host'
    ) as HTMLElement;
    expect(host.shadowRoot?.textContent).toContain('hello');
  });

  it('applies zoom to the content container', async () => {
    const content: SafeHtml = sanitizer.bypassSecurityTrustHtml(
      '<wdoc-container><wdoc-page>zoom</wdoc-page></wdoc-container>'
    );
    component.htmlContent = content;
    component.zoom = 150;
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.nativeElement
      .querySelector('.viewer-shadow-host')
      ?.shadowRoot?.querySelector('wdoc-page') as HTMLElement;
    expect(page.style.zoom).toBe('1.5');
  });

  it('skips zoom application before the view initializes', () => {
    const applySpy = spyOn<any>(component as any, 'applyZoom');
    component.ngOnChanges({ zoom: { currentValue: 120, previousValue: 100 } } as any);

    expect(applySpy).not.toHaveBeenCalled();
  });

  it('applies zoom changes once initialized', fakeAsync(() => {
    const content: SafeHtml = sanitizer.bypassSecurityTrustHtml(
      '<wdoc-container><wdoc-page>zoom</wdoc-page></wdoc-container>'
    );
    component.htmlContent = content;
    fixture.detectChanges();
    tick();

    component.zoom = 110;
    const applySpy = spyOn<any>(component as any, 'applyZoom').and.callThrough();
    component.ngOnChanges({ zoom: { currentValue: 110, previousValue: 100 } } as any);
    tick();

    expect(applySpy).toHaveBeenCalled();
    const page = fixture.nativeElement
      .querySelector('.viewer-shadow-host')
      ?.shadowRoot?.querySelector('wdoc-page') as HTMLElement;
    expect(page.style.zoom).toBe('1.1');
  }));

  it('ignores applyZoom when the container is missing', () => {
    const apply = (component as any).applyZoom.bind(component);
    component.contentContainer = undefined as any;
    expect(() => apply()).not.toThrow();
  });

  it('reapplies zoom when htmlContent changes after init', fakeAsync(() => {
    const content: SafeHtml = sanitizer.bypassSecurityTrustHtml(
      '<wdoc-container><wdoc-page>first</wdoc-page></wdoc-container>'
    );
    component.htmlContent = content;
    fixture.detectChanges();
    tick();

    const applySpy = spyOn<any>(component as any, 'applyZoom').and.callThrough();
    component.htmlContent = sanitizer.bypassSecurityTrustHtml(
      '<wdoc-container><wdoc-page>second</wdoc-page></wdoc-container>'
    );
    component.ngOnChanges({
      htmlContent: { currentValue: 'new', previousValue: 'old' },
    } as any);
    tick();

    expect(applySpy).toHaveBeenCalled();
  }));

  it('isolates document styles inside the shadow root', () => {
    component.htmlContent = sanitizer.bypassSecurityTrustHtml(`
      <style>body { margin: 32px; }</style>
      <div class="doc">content</div>
    `);
    fixture.detectChanges();

    const host = fixture.nativeElement.querySelector(
      '.viewer-shadow-host'
    ) as HTMLElement;
    expect(getComputedStyle(host).margin).toBe('0px');
    expect(host.shadowRoot?.textContent).toContain('content');
  });
});
