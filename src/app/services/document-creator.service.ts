import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { WdocLoaderService } from './wdoc-loader.service';

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
    const manifest = await this.generateContentManifest(zip);
    zip.file('content_manifest.json', manifest);
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

  private async generateContentManifest(zip: JSZip): Promise<string> {
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

    return JSON.stringify(manifest, null, 2);
  }

  private determineRole(path: string): string {
    if (path === 'index.html') {
      return 'doc_core';
    }
    if (path.startsWith('wdoc-form/')) {
      return 'form_instance';
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
      case 'json':
        return 'application/json';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      default:
        return 'application/octet-stream';
    }
  }
}
