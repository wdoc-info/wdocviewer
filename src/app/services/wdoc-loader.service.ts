import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import JSZip from 'jszip';
import { HtmlProcessingService } from './html-processing.service';
import { DialogService } from './dialog.service';

export interface WdocLoadResult {
  html: string;
  documentTitle: string;
  originalArrayBuffer: ArrayBuffer;
  attachments: LoadedFile[];
  formAnswers: LoadedFile[];
}

export interface LoadedFile {
  name: string;
  blob: Blob;
}

@Injectable({ providedIn: 'root' })
export class WdocLoaderService {
  constructor(
    private http: HttpClient,
    private htmlProcessingService: HtmlProcessingService,
    private dialogService: DialogService,
  ) {}

  static async computeSha256(data: Uint8Array): Promise<string> {
    const buffer = data.slice().buffer as ArrayBuffer;
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async fetchAndLoadWdoc(url: string): Promise<WdocLoadResult | null> {
    try {
      const arrayBuffer = await lastValueFrom(
        this.http.get(url, { responseType: 'arraybuffer' }),
      );
      return await this.loadWdocFromArrayBuffer(arrayBuffer);
    } catch (error) {
      console.error(`Error downloading .wdoc/.zip file from ${url}:`, error);
      await this.dialogService.openAlert(
        'Error downloading .wdoc/.zip file from URL.',
        'Download failed',
      );
      return null;
    }
  }

  async loadWdocFromArrayBuffer(
    arrayBuffer: ArrayBuffer,
    defaultTitle = 'WDOC viewer',
  ): Promise<WdocLoadResult | null> {
    try {
      const zip = await JSZip.loadAsync(arrayBuffer);
      const manifestValid = await this.verifyContentManifest(zip);
      if (!manifestValid) {
        return null;
      }
      const indexFile = this.findIndexFile(zip);
      if (!indexFile) {
        await this.dialogService.openAlert(
          'index.html not found in the archive.',
          'Missing entry',
        );
        return null;
      }
      const html = await indexFile.async('text');
      const processed = await this.htmlProcessingService.processHtml(zip, html, {
        defaultTitle,
      });
      const attachments = await this.extractFiles(zip, 'wdoc-attachment');
      const formAnswers = await this.extractFiles(zip, 'wdoc-form', (name) =>
        name.endsWith('.json'),
      );
      return {
        html: processed.html,
        documentTitle: processed.documentTitle,
        originalArrayBuffer: arrayBuffer,
        attachments,
        formAnswers,
      };
    } catch (error) {
      console.error('Error processing zip file:', error);
      await this.dialogService.openAlert(
        'Error processing .wdoc file.',
        'Processing error',
      );
      return null;
    }
  }

  private findIndexFile(zip: JSZip): JSZip.JSZipObject | null {
    let indexFile = zip.file('index.html');
    if (!indexFile) {
      const firstFolder = Object.keys(zip.files)
        .filter((path) => {
          const entry = zip.files[path];
          return (
            entry.dir &&
            path.endsWith('/') &&
            !path.slice(0, -1).includes('/')
          );
        })
        .sort()[0];
      if (firstFolder) {
        indexFile = zip.file(`${firstFolder}index.html`);
      }
    }
    return indexFile ?? null;
  }

  private async verifyContentManifest(zip: JSZip): Promise<boolean> {
    const manifestFile = zip.file('content_manifest.json');
    if (!manifestFile) {
      return true;
    }

    let manifest: any;
    try {
      const manifestText = await manifestFile.async('text');
      manifest = JSON.parse(manifestText);
    } catch (error) {
      console.error('Failed to parse content_manifest.json', error);
      await this.dialogService.openAlert(
        'The document content could not be verified and will not be opened.',
        'Verification failed',
      );
      return false;
    }

    if (manifest.algorithm !== 'sha256' || !Array.isArray(manifest.files)) {
      await this.dialogService.openAlert(
        'The document manifest uses an unsupported format and will not be opened.',
        'Unsupported manifest',
      );
      return false;
    }

    const mismatches: string[] = [];
    for (const file of manifest.files) {
      if (
        !file ||
        typeof file.path !== 'string' ||
        typeof file.sha256 !== 'string'
      ) {
        mismatches.push('content_manifest.json');
        continue;
      }

      const entry = zip.file(file.path);
      if (!entry) {
        mismatches.push(file.path);
        continue;
      }

      try {
        const data = await entry.async('uint8array');
        const sha256 = await WdocLoaderService.computeSha256(data);
        if (sha256 !== file.sha256) {
          mismatches.push(file.path);
        }
      } catch (error) {
        console.error('Failed to verify manifest entry', file.path, error);
        mismatches.push(file.path);
      }
    }

    if (mismatches.length > 0) {
      await this.dialogService.openAlert(
        'The document content does not match its manifest and will not be opened.',
        'Verification failed',
      );
      return false;
    }

    return true;
  }

  private async extractFiles(
    zip: JSZip,
    folderName: string,
    predicate: (name: string) => boolean = () => true,
  ): Promise<LoadedFile[]> {
    const folder = zip.folder(folderName);
    if (!folder) {
      return [];
    }

    const entries = folder.filter((path, file) => !file.dir && predicate(path));
    const root: string | undefined = (folder as any).root;
    const files: LoadedFile[] = [];

    for (const entry of entries) {
      const relativeName =
        root && entry.name.startsWith(root) ? entry.name.slice(root.length) : entry.name;
      const buffer = await entry.async('arraybuffer');
      const mime = this.guessMimeType(relativeName);
      const blob = new Blob([buffer], mime ? { type: mime } : undefined);
      files.push({ name: relativeName, blob });
    }

    return files;
  }

  private guessMimeType(name: string): string | undefined {
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
        return undefined;
    }
  }
}
