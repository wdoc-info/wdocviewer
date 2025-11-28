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

  it('restores checkbox and radio controls from saved data', async () => {
    const html = `
      <html><body>
        <form id="preferences">
          <input type="checkbox" name="subscribe">
          <input type="radio" name="color" value="red">
          <input type="radio" name="color" value="blue">
          <textarea name="notes"></textarea>
        </form>
      </body></html>
    `;
    const zip = new JSZip();
    zip.file('index.html', html);
    const formFolder = zip.folder('wdoc-form')!;
    formFolder.file(
      'preferences.json',
      JSON.stringify({ subscribe: 'true', color: 'blue', notes: 'saved' }),
    );

    const doc = new DOMParser().parseFromString(html, 'text/html');
    await service.populateFormsFromZip(zip, doc);

    const form = doc.getElementById('preferences') as HTMLFormElement;
    expect((form.querySelector('[name="subscribe"]') as HTMLInputElement).checked).toBeTrue();
    const radios = form.querySelectorAll<HTMLInputElement>('input[type="radio"][name="color"]');
    expect(radios[0].checked).toBeFalse();
    expect(radios[1].checked).toBeTrue();
    expect((form.querySelector('textarea[name="notes"]') as HTMLTextAreaElement).value).toBe(
      'saved',
    );
  });

  it('saves form data and attachments back into a wdoc archive', async () => {
    const initialZip = new JSZip();
    initialZip.file('index.html', '<html></html>');
    initialZip.folder('wdoc-form');
    const buffer = await initialZip.generateAsync({ type: 'arraybuffer' });

    const container = document.createElement('div');
    container.innerHTML = `
      <form id="form1">
        <input name="name" value="Ada" />
        <input type="checkbox" name="agree" checked />
        <input type="radio" name="size" value="s" />
        <input type="radio" name="size" value="m" checked />
        <input type="file" name="attachment" />
      </form>
    `;

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['hello'], 'note.txt', { type: 'text/plain' }));
    Object.defineProperty(fileInput, 'files', { value: dataTransfer.files });

    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.callFake(() => 'blob:filled');
    const revokeSpy = spyOn(URL, 'revokeObjectURL');
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

    const saved = await service.saveForms(container, buffer);

    expect(saved).toBeTrue();

    expect(clickSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith('blob:filled');

    const blobArg = createObjectUrlSpy.calls.mostRecent().args[0] as Blob;
    const savedZip = await JSZip.loadAsync(await blobArg.arrayBuffer());

    const savedForm = JSON.parse(
      await savedZip.file('wdoc-form/form1.json')!.async('text'),
    ) as Record<string, string>;
    expect(savedForm['name']).toBe('Ada');
    expect(savedForm['agree']).toBe('on');
    expect(savedForm['size']).toBe('m');
    expect(savedForm['attachment']).toBe('note.txt');

    const attachment = await savedZip.file('wdoc-form/note.txt')!.async('text');
    expect(attachment).toBe('hello');

    const manifest = JSON.parse(
      await savedZip.file('content_manifest.json')!.async('text'),
    ) as { files: Array<{ path: string; role: string; mime: string }>; };
    const roles = manifest.files.reduce<Record<string, string>>((acc, entry) => {
      acc[entry.path] = entry.role;
      return acc;
    }, {});

    expect(roles['index.html']).toBe('doc_core');
    expect(roles['wdoc-form/form1.json']).toBe('form_instance');
    expect(roles['wdoc-form/note.txt']).toBe('form_attachment');
  });

  it('blocks saving when HTML form validation fails', async () => {
    const initialZip = new JSZip();
    initialZip.file('index.html', '<html></html>');
    initialZip.folder('wdoc-form');
    const buffer = await initialZip.generateAsync({ type: 'arraybuffer' });

    const container = document.createElement('div');
    container.innerHTML = `
      <form>
        <input name="name" required />
      </form>
    `;

    const createObjectUrlSpy = spyOn(URL, 'createObjectURL');
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

    const saved = await service.saveForms(container, buffer);

    expect(saved).toBeFalse();
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
