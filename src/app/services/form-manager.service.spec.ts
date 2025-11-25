import { TestBed } from '@angular/core/testing';
import JSZip from 'jszip';
import { FormManagerService } from './form-manager.service';
import { WdocLoaderService } from './wdoc-loader.service';

interface FormDriveEntry {
  role: string;
  mime: string;
}

describe('FormManagerService', () => {
  let service: FormManagerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FormManagerService);
  });

  it('populates forms from wdoc-form folder', async () => {
    const html =
      '<html><head></head><body><form id="f1"><input name="username"/><input type="file" name="photo"/></form><wdoc-page></wdoc-page></body></html>';
    const zip = new JSZip();
    zip.file('index.html', html);
    const folder = zip.folder('wdoc-form')!;
    folder.file(
      'f1.json',
      JSON.stringify({ username: 'bob', photo: 'img.txt' })
    );
    folder.file('img.txt', 'data');

    const doc = new DOMParser().parseFromString(html, 'text/html');
    await service.populateFormsFromZip(zip, doc);

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
});
