import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import {
  ManifestMetaOverrides,
  generateManifest,
  serializeManifest,
} from './manifest-builder';

@Injectable({ providedIn: 'root' })
export class DocumentCreatorService {
  async downloadWdocFromHtml(html: string, filename = 'new-document.wdoc') {
    const blob = await this.buildWdocBlob(html);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async buildWdocBlob(html: string): Promise<Blob> {
    const zip = new JSZip();
    const wrapped = this.wrapHtml(html);
    zip.file('index.html', wrapped);
    zip.folder('wdoc-form');
    const manifest = await this.generateManifest(zip);
    zip.file('manifest.json', manifest);
    return zip.generateAsync({ type: 'blob' });
  }

  private wrapHtml(content: string): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WDOC document</title>
  <style>
    .wdoc-document { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; margin: 32px; line-height: 1.6; }
    .wdoc-document h1, .wdoc-document h2, .wdoc-document h3, .wdoc-document h4 { margin-top: 1.6em; }
    .wdoc-document p { margin: 0.8em 0; }
  </style>
</head>
<body>
<div class="wdoc-document">
${content}
</div>
</body>
</html>`;
  }

  private async generateManifest(zip: JSZip): Promise<string> {
    const manifest = await generateManifest(zip, this.buildManifestMeta());
    return serializeManifest(manifest);
  }

  private buildManifestMeta(): ManifestMetaOverrides {
    return {
      docTitle: 'WDOC document',
      creator: 'wdoc-webapp',
    };
  }
}
