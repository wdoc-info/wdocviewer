import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import JSZip from 'jszip';
import { of, throwError } from 'rxjs';

const createFileList = (files: File[]): FileList => {
  const list: Record<number, File> & {
    length: number;
    item: (index: number) => File | null;
    [Symbol.iterator]: () => IterableIterator<File>;
  } = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      for (const file of files) {
        yield file;
      }
    },
  };
  files.forEach((file, index) => {
    list[index] = file;
  });
  return list as unknown as FileList;
};

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('processHtml should strip script and iframe tags', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    const html =
      '<html><head></head><body><wdoc-page></wdoc-page><script src="foo.js"></script><iframe></iframe><div>ok</div></body></html>';
    const zip = new JSZip();

    const promise = app.processHtml(zip, html);
    const req = httpMock.expectOne('assets/wdoc-styles.css');
    req.flush('');

    const result = await promise;
    httpMock.verify();

    expect(result).not.toContain('<script');
    expect(result).not.toContain('<iframe');
    expect(result).toContain('ok');
  });

  it('updates documentTitle from the head title element', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    const html =
      '<html><head><title>Passport Application</title></head><body><main>Content</main></body></html>';
    const zip = new JSZip();

    const promise = app.processHtml(zip, html);
    const req = httpMock.expectOne('assets/wdoc-styles.css');
    req.flush('');

    await promise;
    httpMock.verify();

    expect(app.documentTitle).toBe('Passport Application');
  });

  it('falls back to the default title when no head title is present', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    const html =
      '<html><head></head><body><main>No title here</main></body></html>';
    const zip = new JSZip();

    const promise = app.processHtml(zip, html);
    const req = httpMock.expectOne('assets/wdoc-styles.css');
    req.flush('');

    await promise;
    httpMock.verify();

    expect(app.documentTitle).toBe('WDOC viewer');
  });

  it('paginates HTML without wdoc-page elements', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    const html =
      '<html><head></head><body><h1>Doc</h1><p>Content</p></body></html>';
    const zip = new JSZip();

    const promise = app.processHtml(zip, html);
    const req = httpMock.expectOne('assets/wdoc-styles.css');
    req.flush('');

    const result = await promise;
    httpMock.verify();

    const doc = new DOMParser().parseFromString(result, 'text/html');
    expect(doc.querySelector('wdoc-container')).toBeTruthy();
    expect(doc.querySelectorAll('wdoc-page').length).toBeGreaterThan(0);
  });

  it('wraps paginated free-flow content inside wdoc-content', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    const html = '<html><head></head><body><p>first</p><p>second</p></body></html>';
    const zip = new JSZip();

    const promise = app.processHtml(zip, html);
    const req = httpMock.expectOne('assets/wdoc-styles.css');
    req.flush('');

    const result = await promise;
    httpMock.verify();

    const doc = new DOMParser().parseFromString(result, 'text/html');
    const firstPage = doc.querySelector('wdoc-page');
    expect(firstPage).not.toBeNull();
    expect(
      Array.from((firstPage as Element).children).map((child) =>
        child.tagName.toLowerCase()
      ),
    ).toEqual(['wdoc-content']);
    expect(firstPage?.querySelector('wdoc-content')?.textContent).toContain(
      'first'
    );
  });

  it('splits long documents across multiple pages when needed', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    const longBody = Array.from({ length: 200 })
      .map((_, idx) => `<p>Paragraph ${idx}</p>`)
      .join('');
    const html = `<html><head></head><body>${longBody}</body></html>`;
    const zip = new JSZip();

    const promise = app.processHtml(zip, html);
    const req = httpMock.expectOne('assets/wdoc-styles.css');
    req.flush('');

    const result = await promise;
    httpMock.verify();

    const doc = new DOMParser().parseFromString(result, 'text/html');
    const pages = doc.querySelectorAll('wdoc-page');
    expect(pages.length).toBeGreaterThan(1);
  });

  it('reserves header and footer height when paginating free-flow content', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    const bodyBlocks = Array.from({ length: 4 })
      .map(
        (_, idx) =>
          `<p style="display:block;height:200px;margin:0">Block ${idx}</p>`
      )
      .join('');

    const html = `
      <html>
        <head></head>
        <body>
          <wdoc-header style="display:block;height:300px;">Header</wdoc-header>
          <wdoc-footer style="display:block;height:300px;">Footer</wdoc-footer>
          ${bodyBlocks}
        </body>
      </html>`;
    console.log(html);
    const zip = new JSZip();

    const promise = app.processHtml(zip, html);
    const req = httpMock.expectOne('assets/wdoc-styles.css');
    req.flush('');

    const result = await promise;
    httpMock.verify();

    const doc = new DOMParser().parseFromString(result, 'text/html');
    const pages = doc.querySelectorAll('wdoc-page');
    expect(pages.length).toBeGreaterThan(1);
  });

  it('applies document CSS to pagination measurements', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    const css =
      '<style>body { font-size: 120px; line-height: 140px; margin: 0; }</style>';
    const longBody = Array.from({ length: 15 })
      .map((_, idx) => `<p style="margin:0">Line ${idx}</p>`)
      .join('');

    const html = `<html><head>${css}</head><body>${longBody}</body></html>`;

    const zip = new JSZip();

    const promise = app.processHtml(zip, html);
    const req = httpMock.expectOne('assets/wdoc-styles.css');
    req.flush('');

    const result = await promise;
    httpMock.verify();

    const doc = new DOMParser().parseFromString(result, 'text/html');
    const pages = doc.querySelectorAll('wdoc-page');
    expect(pages.length).toBeGreaterThan(1);
  });

  it('paginates free-flow content with headers and footers across pages', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    const html = `
      <html>
        <head>
          <title>Display header and footer on every page free flow</title>
          <link rel="stylesheet" href="style.css" />
        </head>
        <body>
          <wdoc-header>header here</wdoc-header>
          <wdoc-footer>footer here</wdoc-footer>
          <h1>Display header and footer on free flow document</h1>
          <p>If you use a free flow document (no &lt;wdoc-page&gt;) it should also be working</p>
          ${Array.from({ length: 22 })
            .map(() => '<p>text</p>')
            .join('')}
          <p>end of the text</p>
        </body>
      </html>
    `;

    const zip = new JSZip();
    zip.file(
      'style.css',
      'body { margin: 0; font-size: 20px; line-height: 32px; } p { margin: 24px 0; } h1 { margin: 32px 0; }'
    );

    const http = TestBed.inject(HttpClient);
    spyOn(http, 'get').and.callFake((url: string, _options?: any) => {
      if (url === 'assets/wdoc-styles.css') {
        return of('' as any);
      }
      return throwError(() => new Error(`Unexpected URL ${url}`));
    });

    const result = await app.processHtml(zip, html);

    const doc = new DOMParser().parseFromString(result, 'text/html');
    const pages = doc.querySelectorAll('wdoc-page');
    expect(pages.length).toBeGreaterThan(1);
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

  it('loads a .wdoc from the url query parameter', async () => {
    const originalUrl = window.location.href;
    window.history.pushState(
      {},
      '',
      '/?url=https%3A%2F%2Fexample.com%2Fsample.wdoc'
    );

    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const httpMock = TestBed.inject(HttpTestingController);

    const loadSpy = spyOn(app, 'loadWdocFromArrayBuffer').and.returnValue(
      Promise.resolve()
    );

    app.ngOnInit();

    const req = httpMock.expectOne('https://example.com/sample.wdoc');
    const buffer = new ArrayBuffer(1);
    req.flush(buffer);

    await Promise.resolve();

    expect(loadSpy).toHaveBeenCalledWith(buffer);

    httpMock.verify();
    window.history.replaceState({}, '', originalUrl);
  });

  it('should include uploaded files when saving forms', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;

    const baseZip = new JSZip();
    baseZip.file('index.html', '<form id="f1"></form><form></form>');
    const arrayBuffer = await baseZip.generateAsync({ type: 'arraybuffer' });
    app.originalArrayBuffer = arrayBuffer;

    const form = document.createElement('form');
    form.setAttribute('id', 'f1');
    const input = document.createElement('input');
    input.type = 'file';
    input.name = 'photo';
    const file = new File(['data'], 'photo.txt');
    const dt = new DataTransfer();
    dt.items.add(file);
    Object.defineProperty(input, 'files', { value: dt.files });
    form.appendChild(input);
    const container = document.createElement('div');
    container.appendChild(form);

    const extraForm = document.createElement('form');
    const textInput = document.createElement('input');
    textInput.name = 'note';
    textInput.value = 'hello';
    extraForm.appendChild(textInput);
    container.appendChild(extraForm);
    app.viewer = { nativeElement: container } as any;

    let savedBlob: Blob | null = null;
    spyOn(URL, 'createObjectURL').and.callFake((b: Blob) => {
      savedBlob = b;
      return 'blob:fake';
    });
    spyOn(URL, 'revokeObjectURL');

    await app.onSaveForms();

    expect(savedBlob).toBeTruthy();
    const resultZip = await JSZip.loadAsync(savedBlob!);
    const json = await resultZip.file('wdoc-form/f1.json')!.async('text');
    expect(JSON.parse(json).photo).toBe('photo.txt');
    expect(resultZip.file('wdoc-form/photo.txt')).toBeTruthy();

    const manifestText = await resultZip
      .file('content_manifest.json')!
      .async('text');
    const manifest = JSON.parse(manifestText);
    expect(manifest.version).toBe('1.0');
    expect(manifest.algorithm).toBe('sha256');
    expect(new Date(manifest.created).toString()).not.toBe('Invalid Date');
    const entries = new Map<string, any>(
      manifest.files.map((f: any) => [f.path, f])
    );
    expect(entries.has('content_manifest.json')).toBeFalse();

    const toHex = (buffer: ArrayBuffer): string =>
      Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const indexEntry = entries.get('index.html');
    expect(indexEntry).toBeTruthy();
    expect(indexEntry.role).toBe('doc_core');
    expect(indexEntry.mime).toBe('text/html');
    const indexDigest = await crypto.subtle.digest(
      'SHA-256',
      await resultZip.file('index.html')!.async('arraybuffer')
    );
    expect(indexEntry.sha256).toBe(toHex(indexDigest));

    const formEntry = entries.get('wdoc-form/f1.json');
    expect(formEntry).toBeTruthy();
    expect(formEntry.role).toBe('form_instance');
    expect(formEntry.mime).toBe('application/json');

    const defaultForm = entries.get('wdoc-form/form-1.json');
    expect(defaultForm).toBeTruthy();
    expect(defaultForm.role).toBe('form_instance');

    const attachmentEntry = entries.get('wdoc-form/photo.txt');
    expect(attachmentEntry).toBeTruthy();
    expect(attachmentEntry.role).toBe('form_attachment');
    expect(attachmentEntry.mime).toBe('text/plain');
  });

  it('shows the drop overlay for dragged files and loads .wdoc files on drop', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    const wdocFile = new File(['demo'], 'sample.wdoc');
    const fileList = createFileList([wdocFile]);
    const dataTransfer = {
      types: ['Files'],
      files: fileList,
      dropEffect: 'none',
    } as unknown as DataTransfer;

    const preventDefault = jasmine.createSpy('preventDefault');
    app.onDragEnter({ preventDefault, dataTransfer } as unknown as DragEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(app.showDropOverlay).toBeTrue();

    const dropPreventDefault = jasmine.createSpy('dropPreventDefault');
    const selectSpy = spyOn(app, 'onFileSelected');
    app.onDrop({
      preventDefault: dropPreventDefault,
      dataTransfer,
    } as unknown as DragEvent);

    expect(dropPreventDefault).toHaveBeenCalled();
    expect(selectSpy).toHaveBeenCalledWith(wdocFile);
    expect(app.showDropOverlay).toBeFalse();

    const nonFilePreventDefault = jasmine.createSpy('nonFilePreventDefault');
    app.onDragEnter({
      preventDefault: nonFilePreventDefault,
      dataTransfer: { types: ['text/plain'] } as unknown as DataTransfer,
    } as unknown as DragEvent);

    expect(nonFilePreventDefault).not.toHaveBeenCalled();
    expect(app.showDropOverlay).toBeFalse();
  });

  it('should populate forms from wdoc-form folder', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    const zip = new JSZip();
    const html =
      '<form id="f1"><input name="username"/><input type="file" name="photo"/></form>';
    zip.file('index.html', html);
    const folder = zip.folder('wdoc-form')!;
    folder.file(
      'f1.json',
      JSON.stringify({ username: 'bob', photo: 'img.txt' })
    );
    folder.file('img.txt', 'data');

    const processedPromise = app.processHtml(zip, html);
    const req = httpMock.expectOne('assets/wdoc-styles.css');
    req.flush('');
    const processed = await processedPromise;
    httpMock.verify();

    const doc = new DOMParser().parseFromString(processed, 'text/html');
    expect(
      (doc.querySelector('input[name="username"]') as HTMLInputElement).value
    ).toBe('bob');
    const link = doc.querySelector(
      'input[name="photo"] + a'
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.textContent).toBe('img.txt');
    expect(link.getAttribute('download')).toBe('img.txt');
    expect(link.getAttribute('href')!.startsWith('blob:')).toBeTrue();
  });

  it('verifyContentManifest allows matching files', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const zip = new JSZip();
    const html = '<html></html>';
    zip.file('index.html', html);
    const encoder = new TextEncoder();
    const shaBuffer = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(html)
    );
    const shaHex = Array.from(new Uint8Array(shaBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    zip.file(
      'content_manifest.json',
      JSON.stringify({
        version: '1.0',
        algorithm: 'sha256',
        files: [
          {
            path: 'index.html',
            sha256: shaHex,
            role: 'doc_core',
            mime: 'text/html',
          },
        ],
      })
    );

    spyOn(window, 'alert');
    const result = await app.verifyContentManifest(zip);
    expect(result).toBeTrue();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('verifyContentManifest blocks mismatched files', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const zip = new JSZip();
    zip.file('index.html', '<html></html>');
    zip.file(
      'content_manifest.json',
      JSON.stringify({
        version: '1.0',
        algorithm: 'sha256',
        files: [
          {
            path: 'index.html',
            sha256: '0'.repeat(64),
            role: 'doc_core',
            mime: 'text/html',
          },
        ],
      })
    );

    const alertSpy = spyOn(window, 'alert');
    const result = await app.verifyContentManifest(zip);
    expect(result).toBeFalse();
    expect(alertSpy).toHaveBeenCalledWith(
      'The document content does not match its manifest and will not be opened.'
    );
  });

  it('verifyContentManifest allows missing manifest files', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const zip = new JSZip();
    zip.file('index.html', '<html></html>');

    const result = await app.verifyContentManifest(zip);

    expect(result).toBeTrue();
  });

  it('verifyContentManifest handles parse errors and unsupported formats', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const zip = new JSZip();
    zip.file('index.html', '<html></html>');
    zip.file('content_manifest.json', 'not-json');

    const alertSpy = spyOn(window, 'alert');
    spyOn(console, 'error');
    const parseResult = await app.verifyContentManifest(zip);
    expect(parseResult).toBeFalse();
    expect(alertSpy).toHaveBeenCalledWith(
      'The document content could not be verified and will not be opened.'
    );

    zip.remove('content_manifest.json');
    zip.file(
      'content_manifest.json',
      JSON.stringify({ algorithm: 'md5', files: [] })
    );
    alertSpy.calls.reset();
    const formatResult = await app.verifyContentManifest(zip);
    expect(formatResult).toBeFalse();
    expect(alertSpy).toHaveBeenCalledWith(
      'The document manifest uses an unsupported format and will not be opened.'
    );
  });

  it('clamps and rounds zoom changes', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;

    app.onZoomChange(10);
    expect(app.zoom).toBe(25);

    app.onZoomChange(199.6);
    expect(app.zoom).toBe(200);

    app.onZoomChange(Number.NaN);
    expect(app.zoom).toBe(25);
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

  it('fits content to the viewport when zoom exceeds the computed fit', () => {
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

  it('converts relative images to data URLs and drops rejected external images', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const http = TestBed.inject(HttpClient);

    const html =
      '<html><head><style>.a{color:red;}</style><link rel="stylesheet" href="/styles/site.css"><link rel="stylesheet" href="styles/site.css"></head>' +
      '<body><img src="/pic.png"/><img src="http://example.com/ext.png"/><wdoc-page></wdoc-page></body></html>';
    const zip = new JSZip();
    zip.file('styles/site.css', '.b{color:blue;}');
    zip.file('pic.png', 'image-bytes');

    spyOn(window, 'confirm').and.returnValue(false);
    const httpSpy = spyOn(http, 'get').and.returnValue(of('body{margin:0;}'));
    const promise = app.processHtml(zip, html);
    const processed = await promise;

    const doc = new DOMParser().parseFromString(processed, 'text/html');
    const firstImg = doc.querySelector('img[src^="data:image/png;base64,"]');
    expect(firstImg).toBeTruthy();
    expect(doc.querySelectorAll('img').length).toBe(1);
    expect(doc.querySelector('style')!.textContent).toContain('.b');
    expect(doc.querySelector('style')!.textContent).toContain(
      'body{margin:0;}'
    );
    expect(httpSpy.calls.mostRecent().args[0]).toBe('assets/wdoc-styles.css');
  });

  it('replicates headers and footers across each page', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const http = TestBed.inject(HttpClient);

    spyOn(http, 'get').and.returnValue(of(''));

    const html =
      '<html><head></head><body>' +
      '<wdoc-header>hey header</wdoc-header>' +
      '<wdoc-page><div>page 1</div></wdoc-page>' +
      '<wdoc-page><div>page 2</div></wdoc-page>' +
      '<wdoc-footer>hey footer</wdoc-footer>' +
      '</body></html>';

    const zip = new JSZip();
    const processed = await app.processHtml(zip, html);

    const doc = new DOMParser().parseFromString(processed, 'text/html');
    const pages = Array.from(doc.querySelectorAll('wdoc-page'));

    expect(pages.length).toBe(2);
    pages.forEach((page) => {
      const firstChild = page.firstElementChild as Element;
      const lastChild = page.lastElementChild as Element;
      expect(firstChild.tagName.toLowerCase()).toBe('wdoc-header');
      expect(lastChild.tagName.toLowerCase()).toBe('wdoc-footer');
      expect(
        Array.from(page.children).map((child) => child.tagName.toLowerCase())
      ).toEqual(['wdoc-header', 'wdoc-content', 'wdoc-footer']);
      expect(page.querySelector('wdoc-content')?.textContent).toContain(
        'page '
      );
    });

    const container = doc.querySelector('wdoc-container');
    expect(container?.querySelectorAll(':scope > wdoc-header').length).toBe(0);
    expect(container?.querySelectorAll(':scope > wdoc-footer').length).toBe(0);
  });

  it('normalizes fit zoom to 100% when content already fits', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    const page = document.createElement('wdoc-page');
    Object.defineProperty(page, 'offsetWidth', { value: 100 });
    container.appendChild(page);
    app.viewer = { nativeElement: container } as any;

    expect(app['calculateFitZoom']()).toBe(100);
  });

  it('returns null from calculateFitZoom when prerequisites are missing', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;

    expect(app['calculateFitZoom']()).toBeNull();

    app.viewer = { nativeElement: document.createElement('div') } as any;
    expect(app['calculateFitZoom']()).toBeNull();

    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {
      value: 0,
      configurable: true,
    });
    app.viewer = { nativeElement: container } as any;
    expect(app['calculateFitZoom']()).toBeNull();

    Object.defineProperty(container, 'clientWidth', { value: 200 });
    const page = document.createElement('wdoc-page');
    Object.defineProperty(page, 'offsetWidth', { value: 0 });
    container.appendChild(page);
    expect(app['calculateFitZoom']()).toBeNull();
  });

  it('falls back to the first child when no wdoc-page is present', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 500 });
    const child = document.createElement('div');
    Object.defineProperty(child, 'offsetWidth', { value: 250 });
    container.appendChild(child);
    app.viewer = { nativeElement: container } as any;

    expect(app['calculateFitZoom']()).toBe(100);
  });

  it('handles drag interactions and file detection robustly', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;

    expect(
      app['containsFiles']({ dataTransfer: null } as DragEvent)
    ).toBeFalse();
    expect(
      app['containsFiles']({
        dataTransfer: { types: ['text/plain'] },
      } as unknown as DragEvent)
    ).toBeFalse();

    const dataTransfer = { types: ['Files'] } as unknown as DataTransfer;
    expect(app['containsFiles']({ dataTransfer } as DragEvent)).toBeTrue();

    const preventDefault = jasmine.createSpy('preventDefault');
    app.dragDepth = 2;
    app.showDropOverlay = true;
    app.onDragLeave({ preventDefault, dataTransfer } as unknown as DragEvent);
    expect(app.dragDepth).toBe(1);
    expect(app.showDropOverlay).toBeTrue();

    app.onDragLeave({ preventDefault, dataTransfer } as unknown as DragEvent);
    expect(app.dragDepth).toBe(0);
    expect(app.showDropOverlay).toBeFalse();

    const overEvent = {
      preventDefault,
      dataTransfer: { ...dataTransfer, dropEffect: 'none' },
    } as unknown as DragEvent;
    app.onDragOver(overEvent);
    expect((overEvent as any).dataTransfer.dropEffect).toBe('copy');
  });

  it('keeps confirmed external images when allowed by the user', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const http = TestBed.inject(HttpClient);
    const html =
      '<html><head></head><body><img src="http://example.com/ext.png"/><wdoc-page></wdoc-page></body></html>';
    const zip = new JSZip();

    spyOn(window, 'confirm').and.returnValue(true);
    spyOn(http, 'get').and.returnValue(of(''));

    const processed = await app.processHtml(zip, html);
    const doc = new DOMParser().parseFromString(processed, 'text/html');
    expect(doc.querySelectorAll('img').length).toBe(1);
  });

  it('derives MIME types and roles for known extensions', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;

    expect(app['guessMimeType']('file.html')).toBe('text/html');
    expect(app['guessMimeType']('style.css')).toBe('text/css');
    expect(app['guessMimeType']('script.js')).toBe('application/javascript');
    expect(app['guessMimeType']('data.json')).toBe('application/json');
    expect(app['guessMimeType']('image.png')).toBe('image/png');
    expect(app['guessMimeType']('image.jpg')).toBe('image/jpeg');
    expect(app['guessMimeType']('image.gif')).toBe('image/gif');
    expect(app['guessMimeType']('document.pdf')).toBe('application/pdf');
    expect(app['guessMimeType']('notes.txt')).toBe('text/plain');
    expect(app['guessMimeType']('unknown.bin')).toBe(
      'application/octet-stream'
    );

    expect(app['determineRole']('index.html')).toBe('doc_core');
    expect(app['determineRole']('wdoc-form/f1.json')).toBe('form_instance');
    expect(app['determineRole']('wdoc-form/photo.png')).toBe('form_attachment');
    expect(app['determineRole']('assets/logo.png')).toBe('asset');
  });

  it('loads nested index files within the zip archive', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const zip = new JSZip();
    zip.folder('docs')!.file('index.html', '<html><body>Nested</body></html>');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const processSpy = spyOn(app, 'processHtml').and.returnValue(
      Promise.resolve('<body>processed</body>')
    );

    await app['loadWdocFromArrayBuffer'](buffer);

    expect(processSpy).toHaveBeenCalled();
    expect(app.htmlContent).toBeTruthy();
  });

  it('alerts when no index file is present', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const zip = new JSZip();
    zip.file('readme.txt', 'info');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const alertSpy = spyOn(window, 'alert');
    spyOn(app, 'processHtml');

    await app['loadWdocFromArrayBuffer'](buffer);

    expect(alertSpy).toHaveBeenCalledWith(
      'index.html not found in the .wdoc file.'
    );
    expect(app.processHtml).not.toHaveBeenCalled();
  });

  it('handles download errors while fetching remote .wdoc files', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const http = TestBed.inject(HttpClient);
    spyOn(http, 'get').and.returnValue(throwError(() => new Error('404')));
    const alertSpy = spyOn(window, 'alert');

    await app['fetchAndLoadWdoc']('https://example.com/fail.wdoc');

    expect(alertSpy).toHaveBeenCalledWith(
      'Error downloading .wdoc file from URL.'
    );
  });

  it('ignores drop events without .wdoc files', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    app.dragDepth = 2;
    app.showDropOverlay = true;

    const alertSpy = spyOn(window, 'alert');
    const dataTransfer = {
      types: ['Files'],
      files: [new File(['text'], 'notes.txt')] as any,
    } as unknown as DataTransfer;

    app.onDrop({ preventDefault() {}, dataTransfer } as DragEvent);

    expect(app.dragDepth).toBe(0);
    expect(app.showDropOverlay).toBeFalse();
    expect(alertSpy).toHaveBeenCalledWith('Please drop a .wdoc file.');
  });

  it('does not adjust zoom when fit calculation is unavailable', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    app.zoom = 150;
    app.viewer = undefined as any;
    app['fitContentToViewport']();
    expect(app.zoom).toBe(150);
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

    const responsiveSpy = spyOn<any>(app, 'applyResponsiveLayout');
    app['onWindowResize'](800);
    expect(responsiveSpy).toHaveBeenCalledWith(800);
  }));

  it('logs CSS load failures when applying wdoc styles', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const http = TestBed.inject(HttpClient);
    spyOn(http, 'get').and.returnValue(throwError(() => new Error('no css')));
    const errorSpy = spyOn(console, 'error');

    const html =
      '<html><head></head><body><wdoc-page></wdoc-page></body></html>';
    const zip = new JSZip();
    await app.processHtml(zip, html);

    expect(errorSpy).toHaveBeenCalled();
  });

  it('populates radio buttons, checkboxes, selects, and textareas from form data', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const http = TestBed.inject(HttpClient);
    spyOn(http, 'get').and.returnValue(of(''));

    const zip = new JSZip();
    const html =
      '<html><head></head><body>' +
      '<form id="f2">' +
      '<input type="checkbox" name="agree" />' +
      '<input type="radio" name="choice" value="a" />' +
      '<input type="radio" name="choice" value="b" />' +
      '<input type="file" name="upload" />' +
      '<select name="country"><option value="US">US</option><option value="CA">CA</option></select>' +
      '<textarea name="notes"></textarea>' +
      '</form><wdoc-page></wdoc-page></body></html>';
    zip.file('index.html', html);
    const folder = zip.folder('wdoc-form')!;
    folder.file(
      'f2.json',
      JSON.stringify({
        agree: '1',
        choice: 'b',
        country: 'CA',
        notes: 'hello',
        upload: 'asset.bin',
      })
    );
    folder.file('asset.bin', 'file-data');

    const mimeSpy = spyOn<any>(app, 'guessMimeType').and.returnValue('');
    const urlSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:link');

    const doc = new DOMParser().parseFromString(html, 'text/html');
    await (app as any).populateFormsFromZip(zip, doc);
    expect(
      (doc.querySelector('input[name="agree"]') as HTMLInputElement).checked
    ).toBeTrue();
    const radio = doc.querySelector(
      'input[name="choice"][value="b"]'
    ) as HTMLInputElement;
    expect(radio.checked).toBeTrue();
    const select = doc.querySelector(
      'select[name="country"]'
    ) as HTMLSelectElement;
    expect(select.value).toBe('CA');
    const textarea = doc.querySelector(
      'textarea[name="notes"]'
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('hello');
    expect(textarea.textContent).toBe('hello');
    const link = doc.querySelector(
      'input[name="upload"] + a'
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('download')).toBe('asset.bin');
    expect(link.href).toBe('blob:link');
    expect(mimeSpy).toHaveBeenCalled();
    expect(urlSpy).toHaveBeenCalled();
  });

  it('warns when relative images are missing from the archive', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const http = TestBed.inject(HttpClient);
    spyOn(http, 'get').and.returnValue(of(''));
    const warnSpy = spyOn(console, 'warn');

    const html =
      '<html><head></head><body><img src="missing.png"/><wdoc-page></wdoc-page></body></html>';
    const zip = new JSZip();

    await app.processHtml(zip, html);

    expect(warnSpy).toHaveBeenCalledWith('File missing.png not found in zip.');
  });

  it('applies form data even when folder root metadata is missing', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const fakeFolder = {
      root: '',
      filter: () => [
        {
          name: 'form-1.json',
          async: async () => JSON.stringify({ value: 'set' }),
        },
      ],
      file: () => null,
    } as any;
    const zip = { folder: () => fakeFolder } as any;
    const doc = new DOMParser().parseFromString(
      '<form id="form-1"><input name="value" /></form>',
      'text/html'
    );

    await app.populateFormsFromZip(zip, doc);

    expect(
      (doc.querySelector('input[name="value"]') as HTMLInputElement).value
    ).toBe('set');
  });
});
