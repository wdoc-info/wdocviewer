import { TestBed } from '@angular/core/testing';
import JSZip from 'jszip';
import { DocumentCreatorService } from './document-creator.service';

describe('DocumentCreatorService', () => {
  let service: DocumentCreatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DocumentCreatorService);
  });

  it('builds a wdoc blob with an index and manifest entries', async () => {
    const blob = await service.buildWdocBlob('<p>Draft</p>');
    const arrayBuffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const index = zip.file('index.html');
    const manifest = zip.file('content_manifest.json');

    expect(index).toBeTruthy();
    expect(manifest).toBeTruthy();

    const manifestJson = JSON.parse(await manifest!.async('text'));
    const filePaths = manifestJson.files.map((f: any) => f.path);
    expect(filePaths).toContain('index.html');
  });

  it('scopes default styles to the document wrapper', async () => {
    const blob = await service.buildWdocBlob('<p>Draft</p>');
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const indexContent = await zip.file('index.html')!.async('text');

    expect(indexContent).toContain('class="wdoc-document"');
    expect(indexContent).toContain('.wdoc-document h1');
    expect(indexContent.includes('body {')).toBeFalse();
  });
});
