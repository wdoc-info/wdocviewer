import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import JSZip from 'jszip';
import { HtmlPageSplitter } from '../pagination/html-pages/HtmlPageSplitter';
import { NavbarComponent } from '../navbar/navbar.component';
import { ViewerComponent } from '../viewer/viewer.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { MatDrawerMode, MatSidenavModule } from '@angular/material/sidenav';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    ViewerComponent,
    TopbarComponent,
    MatSidenavModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
  htmlContent: SafeHtml | null = null;
  showSave = false;
  isNavOpen = false;
  sidenavMode: MatDrawerMode = 'over';
  showDropOverlay = false;
  zoom = 100;
  private readonly defaultTitle = 'WDOC viewer';
  private readonly minZoom = 25;
  private readonly maxZoom = 200;
  documentTitle = this.defaultTitle;
  private originalArrayBuffer: ArrayBuffer | null = null;
  private paginationStyleEl?: HTMLStyleElement;
  private resizeListener?: () => void;
  private isDesktop = false;
  private beforePrintListener?: () => void;
  private afterPrintListener?: () => void;
  private wasNavOpenBeforePrint = false;
  private htmlPageSplitter?: HtmlPageSplitter;
  private paginationContainer?: HTMLElement;
  private dragDepth = 0;
  @ViewChild(ViewerComponent) viewer!: ViewerComponent;

  constructor(private sanitizer: DomSanitizer, private http: HttpClient) {
    if (typeof document !== 'undefined') {
      this.paginationContainer = this.createPaginationContainer();
      if (this.paginationContainer) {
        this.htmlPageSplitter = new HtmlPageSplitter({
          container: this.paginationContainer,
          pageHeight: 1122,
        });
      }
    }
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.applyResponsiveLayout(window.innerWidth);
      this.resizeListener = () => this.onWindowResize(window.innerWidth);
      window.addEventListener('resize', this.resizeListener);
      this.beforePrintListener = () => {
        this.wasNavOpenBeforePrint = this.isNavOpen;
        this.closeNav();
      };
      window.addEventListener('beforeprint', this.beforePrintListener);
      this.afterPrintListener = () => {
        this.isNavOpen = this.wasNavOpenBeforePrint;
      };
      window.addEventListener('afterprint', this.afterPrintListener);
    }
    if (typeof window === 'undefined' || !window.location) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const rawUrl = params.get('url');
    if (!rawUrl) {
      return;
    }

    const trimmedUrl = rawUrl.trim();
    if (!this.isSupportedArchive(trimmedUrl)) {
      return;
    }

    void this.fetchAndLoadWdoc(trimmedUrl);
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      if (this.resizeListener) {
        window.removeEventListener('resize', this.resizeListener);
      }
      if (this.beforePrintListener) {
        window.removeEventListener('beforeprint', this.beforePrintListener);
      }
      if (this.afterPrintListener) {
        window.removeEventListener('afterprint', this.afterPrintListener);
      }
    }
    if (this.paginationStyleEl?.parentElement) {
      this.paginationStyleEl.remove();
    }
    if (this.paginationContainer?.parentElement) {
      this.paginationContainer.remove();
    }
    this.htmlPageSplitter?.abort();
  }

  onFileSelected(file: File) {
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const arrayBuffer = e.target?.result;
      if (arrayBuffer instanceof ArrayBuffer) {
        await this.loadWdocFromArrayBuffer(arrayBuffer);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  toggleNav() {
    this.isNavOpen = !this.isNavOpen;
    setTimeout(() => this.fitContentToViewport());
  }

  closeNav() {
    this.isNavOpen = false;
    setTimeout(() => this.fitContentToViewport());
  }

  @HostListener('document:dragenter', ['$event'])
  onDragEnter(event: DragEvent) {
    if (!this.containsFiles(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth++;
    this.showDropOverlay = true;
  }

  @HostListener('document:dragover', ['$event'])
  onDragOver(event: DragEvent) {
    if (!this.containsFiles(event)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.showDropOverlay = true;
  }

  @HostListener('document:dragleave', ['$event'])
  onDragLeave(event: DragEvent) {
    if (!this.containsFiles(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) {
      this.showDropOverlay = false;
    }
  }

  @HostListener('document:drop', ['$event'])
  onDrop(event: DragEvent) {
    if (!this.containsFiles(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropOverlay = false;
    const files = event.dataTransfer?.files;
    if (!files?.length) {
      return;
    }
    const archiveFile = Array.from(files).find((file) =>
      this.isSupportedArchive(file.name)
    );
    if (!archiveFile) {
      alert('Please drop a .wdoc or .zip file.');
      return;
    }
    this.onFileSelected(archiveFile);
  }

  private containsFiles(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) {
      return false;
    }
    return Array.from(types).includes('Files');
  }

  private onWindowResize(width: number) {
    this.applyResponsiveLayout(width);
    this.fitContentToViewport();
  }

  private applyResponsiveLayout(width: number) {
    const isDesktop = width >= 992;
    this.sidenavMode = isDesktop ? 'side' : 'over';
    if (isDesktop !== this.isDesktop) {
      this.isDesktop = isDesktop;
      this.isNavOpen = isDesktop;
      setTimeout(() => this.fitContentToViewport());
    }
  }

  onZoomChange(zoom: number) {
    this.zoom = this.clampZoom(zoom);
  }

  private clampZoom(value: number): number {
    const bounded = Math.round(Number.isFinite(value) ? value : this.minZoom);
    return Math.min(this.maxZoom, Math.max(this.minZoom, bounded));
  }

  private fitContentToViewport(force = false) {
    const fitZoom = this.calculateFitZoom();
    if (fitZoom === null) {
      return;
    }
    if (force || this.zoom > fitZoom) {
      this.zoom = fitZoom;
    }
  }

  private calculateFitZoom(): number | null {
    if (!this.viewer || !this.viewer.nativeElement) {
      return null;
    }

    const containerWidth = this.viewer.nativeElement.clientWidth;
    if (!containerWidth) {
      return null;
    }

    const pageElement = (this.viewer.nativeElement.querySelector('wdoc-page') ||
      this.viewer.nativeElement.firstElementChild) as HTMLElement | null;

    if (!pageElement) {
      return null;
    }

    const baseWidth = pageElement.offsetWidth;
    if (!baseWidth) {
      return null;
    }

    const fitPercent = Math.floor(((containerWidth - 24) / baseWidth) * 100);
    return fitPercent > 100 ? 100 : fitPercent;
  }

  private async fetchAndLoadWdoc(url: string): Promise<void> {
    try {
      const arrayBuffer = await lastValueFrom(
        this.http.get(url, { responseType: 'arraybuffer' })
      );
      await this.loadWdocFromArrayBuffer(arrayBuffer);
    } catch (error) {
      console.error(`Error downloading .wdoc/.zip file from ${url}:`, error);
      alert('Error downloading .wdoc/.zip file from URL.');
    }
  }

  private async loadWdocFromArrayBuffer(
    arrayBuffer: ArrayBuffer
  ): Promise<void> {
    try {
      const zip = await JSZip.loadAsync(arrayBuffer);
      const manifestValid = await this.verifyContentManifest(zip);
      if (!manifestValid) {
        return;
      }
      this.originalArrayBuffer = arrayBuffer;
      this.showSave = false;
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
      if (!indexFile) {
        alert('index.html not found in the archive.');
        return;
      }
      const html = await indexFile.async('text');
      const processedHtml = await this.processHtml(zip, html);
      // Bypass Angular's security after processing the content
      this.htmlContent = this.sanitizer.bypassSecurityTrustHtml(processedHtml);
      if (!this.isDesktop) {
        this.isNavOpen = false;
      }
      setTimeout(() => {
        this.attachFormListeners();
        this.fitContentToViewport(true);
      });
    } catch (error) {
      console.error('Error processing zip file:', error);
      alert('Error processing .wdoc file.');
    }
  }

  private isSupportedArchive(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.endsWith('.wdoc') || lower.endsWith('.zip');
  }

  private attachFormListeners() {
    if (!this.viewer) {
      return;
    }
    const container = this.viewer.nativeElement;
    if (!container) {
      return;
    }
    const controls = container.querySelectorAll('input, textarea, select');
    controls.forEach((el) => {
      el.addEventListener('input', () => (this.showSave = true));
      el.addEventListener('change', () => (this.showSave = true));
    });
  }

  async onSaveForms() {
    if (
      !this.originalArrayBuffer ||
      !this.viewer ||
      !this.viewer.nativeElement
    ) {
      return;
    }
    const newZip = await JSZip.loadAsync(this.originalArrayBuffer);
    const formsFolder = newZip.folder('wdoc-form');
    const forms = Array.from(
      this.viewer.nativeElement.querySelectorAll('form')
    );
    let idx = 1;
    for (const form of forms) {
      const fd = new FormData(form as HTMLFormElement);
      const data: Record<string, unknown> = {};
      for (const [key, value] of fd.entries()) {
        if (typeof value === 'string') {
          data[key] = value;
        } else {
          const input = form.querySelector(
            `[name="${key}"]`
          ) as HTMLInputElement | null;
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
    this.updateDocumentTitle(doc);

    // 1. Remove external script tags with a "src" attribute and all iframes.
    const scripts = doc.querySelectorAll('script');
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

    this.applyPaginationStyles(combinedCSS);

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
      const templateMeasurements = this.prepareTemplates(doc);
      await this.paginateContent(
        doc,
        templateMeasurements.headerHeight + templateMeasurements.footerHeight,
      );
      this.applyTemplatesToPages(doc, templateMeasurements);
    } else {
      // If there is no wdoc-container, we add it
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
      const templateMeasurements = this.prepareTemplates(doc);
      this.applyTemplatesToPages(doc, templateMeasurements);
    }

    await this.populateFormsFromZip(zip, doc);
    return doc.documentElement.outerHTML;
  }

  private updateDocumentTitle(doc: Document): void {
    const title = this.extractHeadTitle(doc);
    this.documentTitle = title && title.length > 0 ? title : this.defaultTitle;
  }

  private applyPaginationStyles(cssText: string) {
    if (typeof document === 'undefined') {
      return;
    }

    if (!this.paginationStyleEl) {
      this.paginationStyleEl = document.createElement('style');
      this.paginationStyleEl.setAttribute('data-pagination-styles', 'true');
      document.head.appendChild(this.paginationStyleEl);
    }

    this.paginationStyleEl.textContent = cssText;

    if (this.paginationContainer) {
      const probePage = document.createElement('wdoc-page');
      probePage.style.visibility = 'hidden';
      probePage.style.position = 'absolute';
      probePage.style.pointerEvents = 'none';
      probePage.style.left = '0';
      probePage.style.top = '0';
      this.paginationContainer.appendChild(probePage);
      const measuredHeight = Math.ceil(probePage.getBoundingClientRect().height);
      this.paginationContainer.removeChild(probePage);
      if (measuredHeight > 0) {
        this.htmlPageSplitter = new HtmlPageSplitter({
          ...this.htmlPageSplitter?.defaultOptions,
          container: this.paginationContainer,
          pageHeight: measuredHeight,
        });
      }
    }
  }

  private extractHeadTitle(doc: Document): string | null {
    const headTitle = doc.querySelector('head title');
    const titleText = headTitle?.textContent?.trim();
    return titleText && titleText.length > 0 ? titleText : null;
  }

  private extractTemplate(doc: Document, selector: string): Element | null {
    const elements = Array.from(doc.querySelectorAll(selector));
    if (elements.length === 0) {
      return null;
    }
    const template = elements[0].cloneNode(true) as Element;
    elements.forEach((element) => element.remove());
    return template;
  }

  private prepareTemplates(doc: Document): {
    headerTemplate: Element | null;
    footerTemplate: Element | null;
    headerHeight: number;
    footerHeight: number;
  } {
    const headerTemplate = this.extractTemplate(doc, 'wdoc-header');
    const footerTemplate = this.extractTemplate(doc, 'wdoc-footer');

    const headerHeight = headerTemplate
      ? this.measureTemplateHeight(headerTemplate)
      : 0;
    const footerHeight = footerTemplate
      ? this.measureTemplateHeight(footerTemplate)
      : 0;

    return { headerTemplate, footerTemplate, headerHeight, footerHeight };
  }

  private ensurePageContentContainer(page: Element): Element {
    const doc = page.ownerDocument;
    const headers = Array.from(page.querySelectorAll(':scope > wdoc-header'));
    const footers = Array.from(
      page.querySelectorAll(':scope > wdoc-footer, :scope > doc-footer')
    );
    let content = page.querySelector(':scope > wdoc-content') as Element | null;

    if (!content) {
      content = doc.createElement('wdoc-content');
    }

    const reservedElements = new Set<Element>([
      ...headers,
      ...footers,
      content,
    ]);

    Array.from(page.childNodes).forEach((child) => {
      if (
        (child.nodeType === Node.ELEMENT_NODE &&
          reservedElements.has(child as Element)) ||
        child === content
      ) {
        return;
      }
      content!.appendChild(child);
    });

    const fragment = doc.createDocumentFragment();
    headers.forEach((header) => fragment.appendChild(header));
    fragment.appendChild(content);
    footers.forEach((footer) => fragment.appendChild(footer));

    page.appendChild(fragment);

    return content;
  }

  private measureTemplateHeight(template: Element): number {
    if (!this.paginationContainer) {
      return 0;
    }

    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.display = 'block';
    wrapper.appendChild(template.cloneNode(true));
    this.paginationContainer.appendChild(wrapper);
    const height = Math.ceil(wrapper.getBoundingClientRect().height);
    this.paginationContainer.removeChild(wrapper);
    return height;
  }

  private applyTemplatesToPages(
    doc: Document,
    templates: {
      headerTemplate: Element | null;
      footerTemplate: Element | null;
    },
  ) {
    const { headerTemplate, footerTemplate } = templates;

    const pages = Array.from(doc.querySelectorAll('wdoc-page'));
    pages.forEach((page) => {
      const contentElement = this.ensurePageContentContainer(page);
      if (headerTemplate) {
        page.insertBefore(headerTemplate.cloneNode(true), contentElement);
      }
      if (footerTemplate) {
        page.appendChild(footerTemplate.cloneNode(true));
      }
      this.ensurePageContentContainer(page);
    });
  }

  /**
   * Paginate the document body into <wdoc-page> elements, each wrapped in a div for scaling.
   *
   * TODO: doesn t work, the example overflowing_text doesn t display on multiple pages
   */
  private async paginateContent(
    doc: Document,
    reservedHeight = 0,
  ): Promise<void> {
    if (!this.htmlPageSplitter) {
      console.warn('HtmlPageSplitter is not available; skipping pagination.');
      return;
    }

    const body = doc.body;
    const contentNodes = Array.from(body.childNodes).filter((node) => {
      return !(
        node.nodeType === Node.ELEMENT_NODE &&
        (node as Element).tagName.toLowerCase() === 'style'
      );
    });

    if (contentNodes.length === 0) {
      return;
    }

    const wrapper = doc.createElement('div');
    contentNodes.forEach((node) => {
      wrapper.appendChild(node.cloneNode(true));
      node.remove();
    });

    const wdocContainer = doc.createElement('wdoc-container');
    body.appendChild(wdocContainer);

    let hasPages = false;
    const adjustedHeight = Math.max(
      1,
      (this.htmlPageSplitter.defaultOptions.pageHeight ?? 1122) -
        Math.max(0, reservedHeight),
    );

    if (this.paginationContainer) {
      this.paginationContainer.style.minHeight = `${adjustedHeight}px`;
    }

    for await (const pageHtml of this.htmlPageSplitter.split(
      wrapper.innerHTML,
      {
        pageHeight: adjustedHeight,
      }
    )) {
      const trimmed = pageHtml.trim();
      if (!trimmed) {
        continue;
      }
      const page = doc.createElement('wdoc-page');
      page.innerHTML = pageHtml;
      this.ensurePageContentContainer(page);
      wdocContainer.appendChild(page);
      hasPages = true;
    }

    if (!hasPages) {
      const emptyPage = doc.createElement('wdoc-page');
      wdocContainer.appendChild(emptyPage);
    }
  }

  private createPaginationContainer(): HTMLElement | undefined {
    if (typeof document === 'undefined') {
      return undefined;
    }
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.visibility = 'hidden';
    container.style.pointerEvents = 'none';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '793.8px';
    container.style.padding = '20px';
    container.style.boxSizing = 'border-box';
    container.style.minHeight = '1122px';
    container.style.height = 'auto';
    container.style.overflow = 'visible';
    container.style.zIndex = '-1';
    document.body.appendChild(container);
    return container;
  }

  private async populateFormsFromZip(zip: JSZip, doc: Document): Promise<void> {
    const formsFolder = zip.folder('wdoc-form');
    if (!formsFolder) {
      return;
    }

    const formElements = Array.from(doc.querySelectorAll('form'));

    const entries = formsFolder.filter((path) => path.endsWith('.json'));
    const root: string | undefined = (formsFolder as any).root;
    for (const entry of entries) {
      const relativeName =
        root && entry.name.startsWith(root)
          ? entry.name.slice(root.length)
          : entry.name;
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
              const blob = new Blob(
                [buffer],
                mime ? { type: mime } : undefined
              );
              const url = URL.createObjectURL(blob);
              const link = doc.createElement('a');
              link.href = url;
              link.textContent = value;
              link.target = '_blank';
              link.download = value;
              control.insertAdjacentElement('afterend', link);
            }
          }
        } else if (
          control instanceof HTMLInputElement &&
          control.type === 'checkbox'
        ) {
          control.checked = value === 'true' || value === 'on' || value === '1';
        } else if (
          control instanceof HTMLInputElement &&
          control.type === 'radio'
        ) {
          const radio = form.querySelector(
            `input[name="${key}"][value="${value}"]`
          ) as HTMLInputElement | null;
          if (radio) {
            radio.checked = true;
          }
        } else {
          (
            control as
              | HTMLInputElement
              | HTMLTextAreaElement
              | HTMLSelectElement
          ).value = String(value);
          if (control instanceof HTMLInputElement) {
            control.setAttribute('value', String(value));
          } else if (control instanceof HTMLTextAreaElement) {
            control.textContent = String(value);
          }
        }
      }
    }
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
      const sha256 = await this.computeSha256(new Uint8Array(buffer));
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

  private async computeSha256(data: Uint8Array): Promise<string> {
    const buffer = data.slice().buffer as ArrayBuffer;
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
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
      alert(
        'The document content could not be verified and will not be opened.'
      );
      return false;
    }

    if (manifest.algorithm !== 'sha256' || !Array.isArray(manifest.files)) {
      alert(
        'The document manifest uses an unsupported format and will not be opened.'
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
        const sha256 = await this.computeSha256(data);
        if (sha256 !== file.sha256) {
          mismatches.push(file.path);
        }
      } catch (error) {
        console.error('Failed to verify manifest entry', file.path, error);
        mismatches.push(file.path);
      }
    }

    if (mismatches.length > 0) {
      alert(
        'The document content does not match its manifest and will not be opened.'
      );
      return false;
    }

    return true;
  }
}
