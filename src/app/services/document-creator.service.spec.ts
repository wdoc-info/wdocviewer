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

  it('downloads a wdoc with the provided filename', async () => {
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:url');
    const revokeSpy = spyOn(URL, 'revokeObjectURL');
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

    await service.downloadWdocFromHtml('<p>content</p>', 'custom-name.wdoc');

    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith('blob:url');
  });

  it('labels manifest entries with roles and mime types', async () => {
    const zip = new JSZip();
    zip.file('index.html', '<p>hello</p>');
    zip.folder('wdoc-form')?.file('form-1.json', '{}');
    zip.file('assets/image.png', 'data');

    const manifest = await (service as any).generateContentManifest(zip);
    const files = JSON.parse(manifest).files as Array<{ path: string; role: string; mime: string }>;
    const roles = files.reduce<Record<string, string>>((acc, file) => {
      acc[file.path] = file.role;
      return acc;
    }, {});

    expect(roles['index.html']).toBe('doc_core');
    expect(roles['wdoc-form/form-1.json']).toBe('form_instance');
    expect(files.find((f) => f.path === 'assets/image.png')?.mime).toBe('image/png');
  });
});
