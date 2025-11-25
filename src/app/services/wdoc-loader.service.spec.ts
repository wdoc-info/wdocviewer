import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import JSZip from 'jszip';
import { HtmlProcessingService } from './html-processing.service';
import { WdocLoaderService } from './wdoc-loader.service';

describe('WdocLoaderService', () => {
  let service: WdocLoaderService;
  let httpMock: HttpTestingController;
  let htmlProcessor: jasmine.SpyObj<HtmlProcessingService>;

  beforeEach(() => {
    htmlProcessor = jasmine.createSpyObj('HtmlProcessingService', [
      'processHtml',
    ]);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: HtmlProcessingService, useValue: htmlProcessor }],
    });
    service = TestBed.inject(WdocLoaderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('computes SHA-256 hashes', async () => {
    const data = new TextEncoder().encode('hello');
    const sha = await WdocLoaderService.computeSha256(data);
    expect(sha).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    );
  });

  it('verifies manifest entries and blocks mismatches', async () => {
    const zip = new JSZip();
    zip.file('index.html', '<html></html>');
    zip.file(
      'content_manifest.json',
      JSON.stringify({
        version: '1.0',
        algorithm: 'sha256',
        files: [{ path: 'index.html', sha256: '0'.repeat(64) }],
      })
    );

    const alertSpy = spyOn(window, 'alert');
    const ok = await (service as any).verifyContentManifest(zip);
    expect(ok).toBeFalse();
    expect(alertSpy).toHaveBeenCalled();
  });

  it('loads nested index files within the zip archive', async () => {
    const zip = new JSZip();
    zip.folder('docs')!.file('index.html', '<html><body>Nested</body></html>');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    htmlProcessor.processHtml.and.resolveTo({
      html: '<body>processed</body>',
      documentTitle: 'Doc',
    });

    const result = await service.loadWdocFromArrayBuffer(buffer, 'WDOC viewer');

    expect(htmlProcessor.processHtml).toHaveBeenCalled();
    expect(result?.html).toContain('processed');
  });

  it('alerts when no index file is present', async () => {
    const zip = new JSZip();
    zip.file('readme.txt', 'info');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    htmlProcessor.processHtml.and.resolveTo({ html: '', documentTitle: '' });
    const alertSpy = spyOn(window, 'alert');

    const result = await service.loadWdocFromArrayBuffer(buffer);

    expect(result).toBeNull();
    expect(alertSpy).toHaveBeenCalledWith(
      'index.html not found in the archive.'
    );
  });
});
