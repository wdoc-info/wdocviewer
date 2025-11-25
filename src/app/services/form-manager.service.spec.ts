import { TestBed } from '@angular/core/testing';
import JSZip from 'jszip';
import { FormManagerService } from './form-manager.service';
import { WdocLoaderService } from './wdoc-loader.service';

describe('FormManagerService', () => {
  let service: FormManagerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FormManagerService);
  });

  it('should include uploaded files when saving forms', async () => {
    const baseZip = new JSZip();
    baseZip.file('index.html', '<form id="f1"></form><form></form>');
    const buffer = await baseZip.generateAsync({ type: 'arraybuffer' });

    const form = document.createElement('form');
    form.setAttribute('id', 'f1');
    const input = document.createElement('input');
    input.name = 'username';
    input.value = 'alice';
    const fileInput = document.createElement('input');
    fileInput.name = 'photo';
    fileInput.type = 'file';
    const file = new File(['hello'], 'photo.txt', { type: 'text/plain' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    form.appendChild(input);
    form.appendChild(fileInput);

    const container = document.createElement('div');
    container.appendChild(form);
    const extraForm = document.createElement('form');
    extraForm.appendChild(document.createElement('input'));
    container.appendChild(extraForm);

    await service.saveForms(container, buffer);
    const resultZip = await JSZip.loadAsync(buffer);
    const json = await resultZip.file('wdoc-form/f1.json')!.async('text');
    const parsed = JSON.parse(json);
    expect(parsed.username).toBe('alice');
    expect(parsed.photo).toBe('photo.txt');
    expect(resultZip.file('wdoc-form/photo.txt')).toBeTruthy();
  });

  it('populates forms from wdoc-form folder', async () => {
    const html =
      '<html><head></head><body><form id="f1"><input name="username"/><input type="file" name="photo"/></form><wdoc-page></wdoc-page></body></html>';
    const zip = new JSZip();
    zip.file('index.html', html);
    const folder = zip.folder('wdoc-form')!;
    folder.file('f1.json', JSON.stringify({ username: 'bob', photo: 'img.txt' }));
    folder.file('img.txt', 'data');

    const doc = new DOMParser().parseFromString(html, 'text/html');
    await service.populateFormsFromZip(zip, doc);

    expect((doc.querySelector('input[name="username"]') as HTMLInputElement).value).toBe('bob');
    const link = doc.querySelector('input[name="photo"] + a') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.textContent).toBe('img.txt');
    expect(link.getAttribute('download')).toBe('img.txt');
    expect(link.getAttribute('href')!.startsWith('blob:')).toBeTrue();
  });

  it('adds content manifest entries with derived metadata', async () => {
    const baseZip = new JSZip();
    baseZip.file('index.html', '<form id="f1"></form><form></form>');
    const buffer = await baseZip.generateAsync({ type: 'arraybuffer' });

    const form = document.createElement('form');
    form.setAttribute('id', 'f1');
    const input = document.createElement('input');
    input.name = 'username';
    input.value = 'alice';
    form.appendChild(input);

    const container = document.createElement('div');
    container.appendChild(form);
    await service.saveForms(container, buffer);

    const resultZip = await JSZip.loadAsync(buffer);
    const manifestText = await resultZip.file('content_manifest.json')!.async('text');
    const manifest = JSON.parse(manifestText);
    const entries = new Map(manifest.files.map((f: any) => [f.path, f]));

    const formEntry = entries.get('wdoc-form/f1.json');
    expect(formEntry.role).toBe('form_instance');
    expect(formEntry.mime).toBe('application/json');

    const defaultForm = entries.get('wdoc-form/form-1.json');
    expect(defaultForm.role).toBe('form_instance');

    const attachmentEntry = entries.get('wdoc-form/photo.txt');
    if (attachmentEntry) {
      expect(attachmentEntry.role).toBe('form_attachment');
    }
  });
});
