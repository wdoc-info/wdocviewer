import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import JSZip from 'jszip';

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
});
