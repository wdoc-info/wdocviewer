import { Component, ViewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import JSZip from 'jszip';
import { NavbarComponent } from './navbar.component';
import { ViewerComponent } from './viewer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NavbarComponent, ViewerComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  htmlContent: SafeHtml | null = null;
  showSave = false;
  private originalArrayBuffer: ArrayBuffer | null = null;
  @ViewChild(ViewerComponent) viewer!: ViewerComponent;

  constructor(private sanitizer: DomSanitizer, private http: HttpClient) {}

  onFileSelected(file: File) {
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const arrayBuffer = e.target?.result;
      if (arrayBuffer instanceof ArrayBuffer) {
        try {
          this.originalArrayBuffer = arrayBuffer;
          const zip = await JSZip.loadAsync(arrayBuffer);
          const indexFile = zip.file('index.html');
          if (!indexFile) {
            alert('index.html not found in the .wdoc file.');
            return;
          }
          const html = await indexFile.async('text');
          const processedHtml = await this.processHtml(zip, html);
          // Bypass Angular's security after processing the content
          this.htmlContent =
            this.sanitizer.bypassSecurityTrustHtml(processedHtml);
          setTimeout(() => this.attachFormListeners());
        } catch (error) {
          console.error('Error processing zip file:', error);
          alert('Error processing .wdoc file.');
        }
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private attachFormListeners() {
    if (!this.viewer) {
      return;
    }
    const container = this.viewer.nativeElement;
    const controls = container.querySelectorAll('input, textarea, select');
    controls.forEach((el) => {
      el.addEventListener('input', () => (this.showSave = true));
      el.addEventListener('change', () => (this.showSave = true));
    });
  }

  async onSaveForms() {
    if (!this.originalArrayBuffer || !this.viewer) {
      return;
    }
    const newZip = await JSZip.loadAsync(this.originalArrayBuffer);
    const formsFolder = newZip.folder('wdoc-form');
    const forms = Array.from(this.viewer.nativeElement.querySelectorAll('form'));
    let idx = 1;
    forms.forEach((form) => {
      const fd = new FormData(form as HTMLFormElement);
      const data: Record<string, unknown> = {};
      fd.forEach((value, key) => {
        if (typeof value === 'string') {
          data[key] = value;
        } else {
          const file = value as File;
          data[key] = file.name || '';
          if (file && file.size > 0 && file.name) {
            formsFolder?.file(file.name, file);
          }
        }
      });
      const id = form.getAttribute('id');
      const name = id ? `${id}.json` : `form-${idx++}.json`;
      formsFolder?.file(name, JSON.stringify(data));
    });
    const blob = await newZip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'filled.wdoc';
    a.click();
    URL.revokeObjectURL(a.href);
    this.showSave = false;
  }

  /**
   * Processes the HTML content:
   * - Removes external scripts (with a "src" attribute) and iframe elements.
   * - For each <img> tag:
   *   - If the src is a relative path, load the image from the ZIP and convert it to a data URL.
   *   - If the src is external (starts with "http" or "//"), ask the user for confirmation.
   *     If the user declines, the image element is removed.
   */
  async processHtml(zip: JSZip, html: string): Promise<string> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. Remove external script tags with a "src" attribute and all iframes.
    const scripts = doc.querySelectorAll('script[src]');
    scripts.forEach((script) => script.remove());

    // 2.  Remove all iframe elements
    const iframes = doc.querySelectorAll('iframe');
    iframes.forEach((iframe) => iframe.remove());

    // 3. Process image tags
    const images = doc.querySelectorAll('img');
    for (const img of Array.from(images)) {
      const src = img.getAttribute('src');
      if (!src) {
        continue;
      }

      // Check if the image is external
      if (
        src.startsWith('http') ||
        src.startsWith('//') ||
        src.startsWith('data:')
      ) {
        // For external images, ask the user for confirmation
        const confirmLoad = window.confirm(
          `Do you want to load external image: ${src}?`
        );
        if (!confirmLoad) {
          // Remove the image element if the user refuses to load it
          img.remove();
        }
      } else {
        // It's a relative path; normalize it by removing any leading slash
        const normalizedSrc = src.startsWith('/') ? src.slice(1) : src;
        const fileInZip = zip.file(normalizedSrc);
        if (fileInZip) {
          try {
            // Get file content as base64
            const base64Content = await fileInZip.async('base64');
            // Determine MIME type based on file extension (default to image/png)
            const ext = normalizedSrc.split('.').pop()?.toLowerCase();
            let mime = 'image/png';
            if (ext === 'jpg' || ext === 'jpeg') {
              mime = 'image/jpeg';
            } else if (ext === 'gif') {
              mime = 'image/gif';
            } else if (ext === 'svg') {
              mime = 'image/svg+xml';
            }
            const dataUrl = `data:${mime};base64,${base64Content}`;
            img.setAttribute('src', dataUrl);
          } catch (error) {
            console.error(
              `Error reading image ${normalizedSrc} from zip:`,
              error
            );
          }
        } else {
          console.warn(`File ${normalizedSrc} not found in zip.`);
        }
      }
    }

    // 4. Combine CSS from the original head and external source.
    let combinedCSS = '';

    // 4a. Get inline <style> elements from the head.
    const headStyleEls = Array.from(doc.head.querySelectorAll('style'));
    headStyleEls.forEach((el) => {
      if (el.textContent) {
        combinedCSS += el.textContent + '\n';
      }
    });

    // 4b. Get <link rel="stylesheet"> elements from the head.
    const headLinkEls = Array.from(
      doc.head.querySelectorAll('link[rel="stylesheet"]')
    );
    for (const linkEl of headLinkEls) {
      const href = linkEl.getAttribute('href');
      if (
        href &&
        !href.startsWith('http') &&
        !href.startsWith('//') &&
        !href.startsWith('data:')
      ) {
        // Normalize the href by removing a leading slash if present.
        const normalizedHref = href.startsWith('/') ? href.slice(1) : href;
        const cssFile = zip.file(normalizedHref);
        if (cssFile) {
          try {
            const cssContent = await cssFile.async('text');
            combinedCSS += cssContent + '\n';
          } catch (error) {
            console.error(
              `Error loading internal CSS file ${normalizedHref}:`,
              error
            );
          }
        }
      }
    }

    // 4c. Load external CSS from assets (e.g., assets/wdoc-styles.css)
    try {
      const externalCSS = await lastValueFrom(
        this.http.get('assets/wdoc-styles.css', { responseType: 'text' })
      );
      combinedCSS += externalCSS + '\n';
    } catch (error) {
      console.error('Error loading external CSS:', error);
    }

    // 5. Remove the existing head entirely.
    if (doc.head) {
      doc.head.remove();
    }

    // 6. Create a new <style> element containing the combined CSS and insert it at the top of the body.
    const newStyleEl = doc.createElement('style');
    newStyleEl.textContent = combinedCSS;
    doc.body.insertBefore(newStyleEl, doc.body.firstChild);

    // 7. If the document does not contain any <wdoc-page> elements, paginate it.
    if (!doc.querySelector('wdoc-page')) {
      await this.paginateContent(doc);
    } else {
      //If there is no wdoc-container, we add it
      if (
        doc.body.querySelector('wdoc-page') &&
        !doc.body.querySelector('wdoc-container')
      ) {
        const wdocContainer = doc.createElement('wdoc-container');
        // Move all nodes from the body into the wdoc-container.
        while (doc.body.firstChild) {
          wdocContainer.appendChild(doc.body.firstChild);
        }
        doc.body.appendChild(wdocContainer);
      }
    }

    return doc.documentElement.outerHTML;
  }

  /**
   * Paginate the document body into <wdoc-page> elements, each wrapped in a div for scaling.
   *
   * TODO: doesn t work, the example overflowing_text doesn t display on multiple pages
   */
  private async paginateContent(doc: Document): Promise<void> {
    const A4PageHeight = 1122; // Approximate A4 height in pixels.
    const body = doc.body;
    const nodes = Array.from(body.childNodes);
    body.innerHTML = '';

    // Create and attach the page container immediately.
    const wdocContainer = doc.createElement('wdoc-container');
    body.appendChild(wdocContainer);

    // Function to create a new page wrapper and page.
    const createNewPage = (): Element => {
      const page = doc.createElement('wdoc-page');
      wdocContainer.appendChild(page);
      return page;
    };

    // Create the first page.
    let currentPage = createNewPage();

    nodes.forEach((node) => {
      currentPage.appendChild(node);
      // Force a reflow so the browser updates layout.
      const height = (currentPage as HTMLElement).offsetHeight;
      console.log('offsetHeight', height, A4PageHeight);

      // If content exceeds A4 page height, move the node to a new page.
      if (height > A4PageHeight) {
        currentPage.removeChild(node);
        currentPage = createNewPage();
        currentPage.appendChild(node);
      }
    });
  }
}
