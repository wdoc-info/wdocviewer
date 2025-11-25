import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import { FormManagerService } from '../services/form-manager.service';
import { HtmlProcessingService } from '../services/html-processing.service';
import { WdocLoaderService } from '../services/wdoc-loader.service';

describe('AppComponent', () => {
  let formManager: jasmine.SpyObj<FormManagerService>;
  let wdocLoader: jasmine.SpyObj<WdocLoaderService>;
  let htmlProcessor: jasmine.SpyObj<HtmlProcessingService>;

  beforeEach(async () => {
    formManager = jasmine.createSpyObj('FormManagerService', ['saveForms']);
    wdocLoader = jasmine.createSpyObj('WdocLoaderService', ['fetchAndLoadWdoc']);
    htmlProcessor = jasmine.createSpyObj('HtmlProcessingService', ['cleanup']);

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, AppComponent],
      providers: [
        { provide: FormManagerService, useValue: formManager },
        { provide: WdocLoaderService, useValue: wdocLoader },
        { provide: HtmlProcessingService, useValue: htmlProcessor },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should mark showSave when form input changes', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const input = document.createElement('input');
    const container = document.createElement('div');
    container.appendChild(input);
    app.viewer = { nativeElement: container } as any;
    (app as any).attachFormListeners();
    input.dispatchEvent(new Event('input'));
    expect(app.showSave).toBeTrue();
  });

  it('clamps zoom changes within bounds', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;

    app.onZoomChange(10);
    expect(app.zoom).toBe(25);

    app.onZoomChange(199.6);
    expect(app.zoom).toBe(200);

    app.onZoomChange(Number.NaN);
    expect(app.zoom).toBe(25);
  });

  it('fits content to the viewport when zoom exceeds fit value', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 400 });
    const page = document.createElement('wdoc-page');
    Object.defineProperty(page, 'offsetWidth', { value: 500 });
    container.appendChild(page);
    app.viewer = { nativeElement: container } as any;

    app.zoom = 150;
    app['fitContentToViewport']();
    expect(app.zoom).toBe(75);

    app.zoom = 60;
    app['fitContentToViewport']();
    expect(app.zoom).toBe(60);

    app.zoom = 150;
    app['fitContentToViewport'](true);
    expect(app.zoom).toBe(75);
  });

  it('adjusts layout responsively when crossing the desktop threshold', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;

    app.isNavOpen = false;
    app['applyResponsiveLayout'](500);
    expect(app.sidenavMode).toBe('over');
    expect(app.isNavOpen).toBeFalse();

    app.isNavOpen = false;
    app['applyResponsiveLayout'](1200);
    expect(app.sidenavMode).toBe('side');
    expect(app.isNavOpen).toBeTrue();
  });

  it('toggles navigation and handles window resize', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const fitSpy = spyOn(app, 'fitContentToViewport');

    app.isNavOpen = false;
    app.toggleNav();
    tick();
    expect(app.isNavOpen).toBeTrue();
    expect(fitSpy).toHaveBeenCalled();

    fitSpy.calls.reset();
    app.closeNav();
    tick();
    expect(app.isNavOpen).toBeFalse();
    expect(fitSpy).toHaveBeenCalled();
  }));

  it('ignores drop events without supported files', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    (app as any).dragDepth = 2;
    app.showDropOverlay = true;

    const dataTransfer = {
      types: ['Files'],
      files: [new File(['text'], 'notes.txt')] as any,
    } as unknown as DataTransfer;

    app.onDrop({ preventDefault() {}, dataTransfer } as DragEvent);

    expect((app as any).dragDepth).toBe(0);
    expect(app.showDropOverlay).toBeFalse();
  });

  it('calls saveForms when saving and resets showSave', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const buffer = new ArrayBuffer(8);
    (app as any).originalArrayBuffer = buffer;
    const container = document.createElement('div');
    (app as any).viewer = { nativeElement: container } as any;
    formManager.saveForms.and.resolveTo();

    await app.onSaveForms();

    expect(formManager.saveForms).toHaveBeenCalledWith(container, buffer);
    expect(app.showSave).toBeFalse();
  });

  it('handles dragenter/leave to toggle overlay depth', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const eventBase = { preventDefault() {}, dataTransfer: { types: ['Files'] } } as DragEvent;

    app.onDragEnter(eventBase);
    expect((app as any).dragDepth).toBe(1);
    expect(app.showDropOverlay).toBeTrue();

    app.onDragLeave(eventBase);
    expect((app as any).dragDepth).toBe(0);
    expect(app.showDropOverlay).toBeFalse();
  });
});
