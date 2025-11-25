import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import JSZip from 'jszip';
import { of, throwError } from 'rxjs';
import { HtmlProcessingService } from './html-processing.service';
import { DialogService } from './dialog.service';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('HtmlProcessingService', () => {
  const getService = () => TestBed.inject(HtmlProcessingService) as any;
  let dialogService: jasmine.SpyObj<DialogService>;

  beforeEach(() => {
    dialogService = jasmine.createSpyObj('DialogService', ['alert', 'confirm']);
    dialogService.alert.and.resolveTo();
    dialogService.confirm.and.resolveTo(true);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: DialogService, useValue: dialogService }],
    });
  });

  it('strips script and iframe tags', async () => {
    const service = getService();
    const httpMock = TestBed.inject(HttpTestingController);
    const html =
      '<html><head></head><body><wdoc-page></wdoc-page><script src="foo.js"></script><iframe></iframe><div>ok</div></body></html>';
    const zip = new JSZip();

    const promise = service.processHtml(zip, html);
    httpMock.expectOne('assets/wdoc-styles.css').flush('');
    const result = (await promise).html;
    httpMock.verify();

    expect(result).not.toContain('<script');
    expect(result).not.toContain('<iframe');
    expect(result).toContain('ok');
  });

  it('updates documentTitle from the head title element', async () => {
    const service = getService();
    const httpMock = TestBed.inject(HttpTestingController);
    const html =
      '<html><head><title>Passport Application</title></head><body><main>Content</main></body></html>';
    const zip = new JSZip();

    const promise = service.processHtml(zip, html);
    httpMock.expectOne('assets/wdoc-styles.css').flush('');

    const result = await promise;
    httpMock.verify();

    expect(result.documentTitle).toBe('Passport Application');
  });

  it('renders QR codes with the requested error correction level', async () => {
    const service = getService();
    const httpMock = TestBed.inject(HttpTestingController);
    const qrSpy = spyOn<any>(service, 'generateQrCodeDataUrl').and.callFake(
      (_value: string, options: any) => Promise.resolve(`data:${options.errorCorrectionLevel}`),
    );

    const html =
      '<html><head></head><body><wdoc-page><wdoc-barcode errorcorrection="H">hello</wdoc-barcode></wdoc-page></body></html>';
    const zip = new JSZip();

    const promise = service.processHtml(zip, html);
    httpMock.expectOne('assets/wdoc-styles.css').flush('');
    const result = (await promise).html;
    httpMock.verify();

    expect(qrSpy).toHaveBeenCalledWith(
      'hello',
      jasmine.objectContaining({ errorCorrectionLevel: 'H' }),
    );

    const doc = parse(result);
    const barcodeEl = doc.querySelector('wdoc-barcode');
    const img = barcodeEl?.querySelector('img');
    expect(barcodeEl?.getAttribute('text')).toBe('hello');
    expect(img?.getAttribute('src')).toBe('data:H');
  });

  it('renders linear barcodes through JsBarcode', async () => {
    const service = getService();
    const httpMock = TestBed.inject(HttpTestingController);
    const barcodeSpy = spyOn<any>(service, 'generateLinearBarcode').and.callFake(
      (target: SVGElement, value: string, format: string) => {
        target.setAttribute('data-format', format);
        target.setAttribute('data-value', value);
      },
    );

    const html =
      '<html><head></head><body><wdoc-page><wdoc-barcode type="CODE128">ABC123</wdoc-barcode></wdoc-page></body></html>';
    const zip = new JSZip();

    const promise = service.processHtml(zip, html);
    httpMock.expectOne('assets/wdoc-styles.css').flush('');
    const result = (await promise).html;
    httpMock.verify();

    expect(barcodeSpy).toHaveBeenCalledWith(
      jasmine.any(SVGElement),
      'ABC123',
      'CODE128',
    );

    const doc = parse(result);
    const barcodeEl = doc.querySelector('wdoc-barcode');
    const svg = barcodeEl?.querySelector('svg');
    expect(barcodeEl?.getAttribute('text')).toBe('ABC123');
    expect(svg?.getAttribute('data-format')).toBe('CODE128');
    expect(svg?.getAttribute('data-value')).toBe('ABC123');
  });

  it('removes empty barcode placeholders', async () => {
    const service = getService();
    const httpMock = TestBed.inject(HttpTestingController);

    const html =
      '<html><head></head><body><wdoc-page><wdoc-barcode>   </wdoc-barcode></wdoc-page></body></html>';
    const zip = new JSZip();

    const promise = service.processHtml(zip, html);
    httpMock.expectOne('assets/wdoc-styles.css').flush('');
    const result = (await promise).html;
    httpMock.verify();

    const doc = parse(result);
    expect(doc.querySelector('wdoc-barcode')).toBeNull();
    expect(doc.querySelector('wdoc-page')?.textContent?.trim()).toBe('');
  });

  it('paginates HTML without wdoc-page elements', async () => {
    const service = getService();
    const httpMock = TestBed.inject(HttpTestingController);

    const html = '<html><head></head><body><h1>Doc</h1><p>Content</p></body></html>';
    const zip = new JSZip();

    const promise = service.processHtml(zip, html);
    httpMock.expectOne('assets/wdoc-styles.css').flush('');
    const result = (await promise).html;
    httpMock.verify();

    const doc = parse(result);
    expect(doc.querySelector('wdoc-container')).toBeTruthy();
    expect(doc.querySelectorAll('wdoc-page').length).toBeGreaterThan(0);
  });

  it('wraps paginated free-flow content inside wdoc-content', async () => {
    const service = getService();
    const httpMock = TestBed.inject(HttpTestingController);

    const html = '<html><head></head><body><p>first</p><p>second</p></body></html>';
    const zip = new JSZip();

    const promise = service.processHtml(zip, html);
    httpMock.expectOne('assets/wdoc-styles.css').flush('');
    const result = (await promise).html;
    httpMock.verify();

    const doc = parse(result);
    const firstPage = doc.querySelector('wdoc-page');
    expect(firstPage).not.toBeNull();
    expect(
      Array.from((firstPage as Element).children).map((child) => child.tagName.toLowerCase()),
    ).toEqual(['wdoc-content']);
    expect(firstPage?.querySelector('wdoc-content')?.textContent).toContain('first');
  });

  it('replicates headers and footers across each page', async () => {
    const service = getService();
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
    const processed = await service.processHtml(zip, html);

    const doc = parse(processed.html);
    const pages = Array.from(doc.querySelectorAll('wdoc-page'));

    expect(pages.length).toBe(2);
    pages.forEach((page) => {
      const firstChild = page.firstElementChild as Element;
      const lastChild = page.lastElementChild as Element;
      expect(firstChild.tagName.toLowerCase()).toBe('wdoc-header');
      expect(lastChild.tagName.toLowerCase()).toBe('wdoc-footer');
      expect(Array.from(page.children).map((child) => child.tagName.toLowerCase())).toEqual([
        'wdoc-header',
        'wdoc-content',
        'wdoc-footer',
      ]);
    });

    const container = doc.querySelector('wdoc-container');
    expect(container?.querySelectorAll(':scope > wdoc-header').length).toBe(0);
    expect(container?.querySelectorAll(':scope > wdoc-footer').length).toBe(0);
  });

  it('converts relative images to data URLs and drops rejected external images', async () => {
    const service = getService();
    const http = TestBed.inject(HttpClient);

    const html =
      '<html><head><style>.a{color:red;}</style><link rel="stylesheet" href="/styles/site.css"><link rel="stylesheet" href="styles/site.css"></head>' +
      '<body><img src="/pic.png"/><img src="http://example.com/ext.png"/><wdoc-page></wdoc-page></body></html>';
    const zip = new JSZip();
    zip.file('styles/site.css', '.b{color:blue;}');
    zip.file('pic.png', 'image-bytes');

    dialogService.confirm.and.resolveTo(false);
    const httpSpy = spyOn(http, 'get').and.returnValue(of('body{margin:0;}'));
    const processed = await service.processHtml(zip, html);

    const doc = parse(processed.html);
    const firstImg = doc.querySelector('img[src^="data:image/png;base64,"]');
    expect(firstImg).toBeTruthy();
    expect(doc.querySelectorAll('img').length).toBe(1);
    expect(doc.querySelector('style')!.textContent).toContain('.b');
    expect(doc.querySelector('style')!.textContent).toContain('body{margin:0;}');
    expect(httpSpy.calls.mostRecent().args[0]).toBe('assets/wdoc-styles.css');
  });

  it('falls back to QR codes and default error correction when type is missing', async () => {
    const service = getService();
    const httpMock = TestBed.inject(HttpTestingController);
    const qrSpy = spyOn<any>(service, 'generateQrCodeDataUrl').and.resolveTo('data:default');

    const html =
      '<html><head></head><body><wdoc-page><wdoc-barcode>abc</wdoc-barcode></wdoc-page></body></html>';
    const zip = new JSZip();

    const promise = service.processHtml(zip, html);
    httpMock.expectOne('assets/wdoc-styles.css').flush('');
    const result = (await promise).html;
    httpMock.verify();

    expect(qrSpy).toHaveBeenCalledWith(
      'abc',
      jasmine.objectContaining({ errorCorrectionLevel: 'M' }),
    );

    const doc = parse(result);
    const barcodeEl = doc.querySelector('wdoc-barcode');
    const img = barcodeEl?.querySelector('img');
    expect(barcodeEl?.getAttribute('text')).toBe('abc');
    expect(img?.getAttribute('src')).toBe('data:default');
  });

  it('ignores unsupported barcode types gracefully', async () => {
    const service = getService();
    const httpMock = TestBed.inject(HttpTestingController);
    const linearSpy = spyOn<any>(service, 'generateLinearBarcode');

    const html =
      '<html><head></head><body><wdoc-page><wdoc-barcode type="unknown">123</wdoc-barcode></wdoc-page></body></html>';
    const zip = new JSZip();

    const promise = service.processHtml(zip, html);
    httpMock.expectOne('assets/wdoc-styles.css').flush('');
    const result = (await promise).html;
    httpMock.verify();

    expect(linearSpy).not.toHaveBeenCalled();
    const doc = parse(result);
    const barcodeEl = doc.querySelector('wdoc-barcode');
    expect(barcodeEl?.getAttribute('text')).toBe('123');
    expect(barcodeEl?.textContent).toBe('123');
  });
});
