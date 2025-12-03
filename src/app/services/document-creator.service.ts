import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { APP_VERSION } from '../config/app.config';
import { AuthService } from './auth.service';
import {
  ManifestMetaOverrides,
  generateManifest,
  serializeManifest,
} from './manifest-builder';

@Injectable({ providedIn: 'root' })
export class DocumentCreatorService {
  constructor(private authService: AuthService) {}

  async downloadWdocFromHtml(
    html: string,
    docVersion: string,
    docTitle: string,
    filename?: string,
  ) {
    const normalizedTitle = docTitle?.trim() || 'WDOC document';
    const resolvedFilename =
      filename ?? `${this.buildFilenameFromTitle(normalizedTitle)}.wdoc`;
    const blob = await this.buildWdocBlob(html, docVersion, normalizedTitle);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = resolvedFilename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async buildWdocBlob(
    html: string,
    docVersion: string,
    docTitle: string,
  ): Promise<Blob> {
    const zip = new JSZip();
    const wrapped = this.wrapHtml(html, docTitle);
    zip.file('index.html', wrapped);
    zip.folder('wdoc-form');
    const manifest = await this.generateManifest(zip, docVersion, docTitle);
    zip.file('manifest.json', manifest);
    return zip.generateAsync({ type: 'blob' });
  }

  private wrapHtml(content: string, title: string): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${this.escapeHtml(title)}</title>
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

  private async generateManifest(
    zip: JSZip,
    docVersion: string,
    docTitle: string,
  ): Promise<string> {
    const manifest = await generateManifest(
      zip,
      this.buildManifestMeta(docVersion, docTitle),
    );
    return serializeManifest(manifest);
  }

  private buildManifestMeta(
    docVersion: string,
    docTitle: string,
  ): ManifestMetaOverrides {
    const creator = this.authService.getCurrentUserEmail();
    return {
      docTitle: docTitle?.trim() || 'WDOC document',
      appVersion: APP_VERSION,
      docVersion,
      ...(creator ? { creator } : {}),
    };
  }

  private escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return char;
      }
    });
  }

  private buildFilenameFromTitle(title: string): string {
    const safeTitle = title.trim() || 'document';
    const slug = safeTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'document';
  }
}
