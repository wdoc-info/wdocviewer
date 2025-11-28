import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { WdocLoaderService } from './wdoc-loader.service';

@Injectable({ providedIn: 'root' })
export class FormManagerService {
  async populateFormsFromZip(zip: JSZip, doc: Document): Promise<void> {
    const formsFolder = zip.folder('wdoc-form');
    if (!formsFolder) {
      return;
    }

    const formElements = Array.from(doc.querySelectorAll('form'));

    const entries = formsFolder.filter((path) => path.endsWith('.json'));
    const root: string | undefined = (formsFolder as any).root;
    for (const entry of entries) {
      const relativeName =
        root && entry.name.startsWith(root) ? entry.name.slice(root.length) : entry.name;
      let data: Record<string, string>;
      try {
        data = JSON.parse(await entry.async('text'));
      } catch {
        continue;
      }

      const base = relativeName.replace(/\.json$/, '');
      let form: HTMLFormElement | null = null;
      if (base.startsWith('form-')) {
        const idx = parseInt(base.slice(5), 10) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < formElements.length) {
          form = formElements[idx] as HTMLFormElement;
        }
      } else {
        form = doc.getElementById(base) as HTMLFormElement;
      }
      if (!form) {
        continue;
      }

      for (const [key, value] of Object.entries(data)) {
        const control = form.querySelector(`[name="${key}"]`) as
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement
          | null;
        if (!control) {
          continue;
        }
        if (control instanceof HTMLInputElement && control.type === 'file') {
          if (typeof value === 'string' && value) {
            const fileEntry = formsFolder.file(value);
            if (fileEntry) {
              const mime = this.guessMimeType(value);
              const buffer = await fileEntry.async('arraybuffer');
              const blob = new Blob([buffer], mime ? { type: mime } : undefined);
              const url = URL.createObjectURL(blob);
              const link = doc.createElement('a');
              link.href = url;
              link.textContent = value;
              link.target = '_blank';
              link.download = value;
              control.insertAdjacentElement('afterend', link);
            }
          }
        } else if (control instanceof HTMLInputElement && control.type === 'checkbox') {
          control.checked = value === 'true' || value === 'on' || value === '1';
        } else if (control instanceof HTMLInputElement && control.type === 'radio') {
          const radioGroup = form.querySelectorAll<HTMLInputElement>(
            `input[type="radio"][name="${key}"]`,
          );
          radioGroup.forEach((radio) => {
            radio.checked = radio.value === value;
          });
        } else if ('value' in control) {
          control.value = String(value);
        }
      }
    }
  }

  async saveForms(
    formRoot: Document | ShadowRoot | HTMLElement,
    originalArrayBuffer: ArrayBuffer,
  ): Promise<boolean> {
    const forms = Array.from(formRoot.querySelectorAll('form'));
    for (const form of forms) {
      if (!this.isFormValid(form)) {
        return false;
      }
    }

    const newZip = await JSZip.loadAsync(originalArrayBuffer);
    const formsFolder = newZip.folder('wdoc-form');
    let idx = 1;
    for (const form of forms) {
      const fd = new FormData(form as HTMLFormElement);
      const data: Record<string, unknown> = {};
      for (const [key, value] of fd.entries()) {
        if (typeof value === 'string') {
          data[key] = value;
        } else {
          const input = form.querySelector(`[name="${key}"]`) as HTMLInputElement | null;
          const file = input?.files?.[0] as File | undefined;
          if (file && file.size > 0 && file.name) {
            data[key] = file.name;
            const buf = await file.arrayBuffer();
            formsFolder?.file(file.name, buf, { binary: true });
          } else {
            data[key] = '';
          }
        }
      }
      const id = form.getAttribute('id');
      const name = id ? `${id}.json` : `form-${idx++}.json`;
      formsFolder?.file(name, JSON.stringify(data));
    }
    await this.addContentManifest(newZip);
    const blob = await newZip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'filled.wdoc';
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  }

  private isFormValid(form: HTMLFormElement): boolean {
    if (typeof form.reportValidity === 'function') {
      return form.reportValidity();
    }
    if (typeof form.checkValidity === 'function') {
      return form.checkValidity();
    }
    return true;
  }

  private async addContentManifest(zip: JSZip): Promise<void> {
    const files = [] as Array<{
      path: string;
      mime: string;
      sha256: string;
      role: string;
    }>;

    const entries = Object.values(zip.files);
    for (const entry of entries) {
      if (entry.dir || entry.name === 'content_manifest.json') {
        continue;
      }
      const buffer = await entry.async('arraybuffer');
      const sha256 = await WdocLoaderService.computeSha256(new Uint8Array(buffer));
      files.push({
        path: entry.name,
        mime: this.guessMimeType(entry.name),
        sha256,
        role: this.determineRole(entry.name),
      });
    }

    files.sort((a, b) => a.path.localeCompare(b.path));

    const manifest = {
      version: '1.0',
      created: new Date().toISOString(),
      algorithm: 'sha256',
      files,
    };

    zip.file('content_manifest.json', JSON.stringify(manifest, null, 2));
  }

  private determineRole(path: string): string {
    if (path === 'index.html') {
      return 'doc_core';
    }
    if (path.startsWith('wdoc-form/')) {
      return path.endsWith('.json') ? 'form_instance' : 'form_attachment';
    }
    return 'asset';
  }

  private guessMimeType(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'html':
        return 'text/html';
      case 'css':
        return 'text/css';
      case 'js':
        return 'application/javascript';
      case 'json':
        return 'application/json';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'pdf':
        return 'application/pdf';
      case 'txt':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  }
}
