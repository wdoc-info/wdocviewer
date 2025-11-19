import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import JSZip from 'jszip';

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

  it('paginates HTML without wdoc-page elements', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const httpMock = TestBed.inject(HttpTestingController);

    const html = '<html><head></head><body><h1>Doc</h1><p>Content</p></body></html>';
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
    baseZip.file('index.html', '<form id="f1"></form>');
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
    app.onDrop(
      { preventDefault: dropPreventDefault, dataTransfer } as unknown as DragEvent
    );

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
    folder.file('f1.json', JSON.stringify({ username: 'bob', photo: 'img.txt' }));
    folder.file('img.txt', 'data');

    const processedPromise = app.processHtml(zip, html);
    const req = httpMock.expectOne('assets/wdoc-styles.css');
    req.flush('');
    const processed = await processedPromise;
    httpMock.verify();

    const doc = new DOMParser().parseFromString(processed, 'text/html');
    expect((doc.querySelector('input[name="username"]') as HTMLInputElement).value).toBe('bob');
    const link = doc.querySelector('input[name="photo"] + a') as HTMLAnchorElement;
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
});
