import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  AfterViewInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NavbarComponent } from '../navbar/navbar.component';
import { ViewerComponent } from '../viewer/viewer.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { MatDrawerMode, MatSidenavModule } from '@angular/material/sidenav';
import { FormManagerService } from '../services/form-manager.service';
import { HtmlProcessingService } from '../services/html-processing.service';
import {
  LoadedFile,
  WdocLoadResult,
  WdocLoaderService,
} from '../services/wdoc-loader.service';
import { DialogService } from '../services/dialog.service';
import { DocumentEditorComponent } from '../editor/document-editor.component';
import { DocumentCreatorService } from '../services/document-creator.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    ViewerComponent,
    TopbarComponent,
    DocumentEditorComponent,
    MatSidenavModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  htmlContent: SafeHtml | null = null;
  showSave = false;
  isNavOpen = false;
  isEditing = false;
  sidenavMode: MatDrawerMode = 'over';
  showDropOverlay = false;
  zoom = 100;
  private readonly defaultTitle = 'WDOC viewer';
  private readonly newDocumentTitle = 'New document';
  private readonly minZoom = 25;
  private readonly maxZoom = 200;
  documentTitle = this.defaultTitle;
  editorContent = '<p>Start writing...</p>';
  private originalArrayBuffer: ArrayBuffer | null = null;
  private resizeListener?: () => void;
  private isDesktop = false;
  private beforePrintListener?: () => void;
  private afterPrintListener?: () => void;
  private wasNavOpenBeforePrint = false;
  private dragDepth = 0;
  private resizeObserver?: ResizeObserver;
  @ViewChild(ViewerComponent) viewer!: ViewerComponent;

  constructor(
    private sanitizer: DomSanitizer,
    private wdocLoaderService: WdocLoaderService,
    private htmlProcessingService: HtmlProcessingService,
    private formManagerService: FormManagerService,
    private dialogService: DialogService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private documentCreatorService: DocumentCreatorService,
  ) {}

  attachments: LoadedFile[] = [];
  formAnswers: LoadedFile[] = [];

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.setupFileHandler();
      this.applyResponsiveLayout(window.innerWidth);
      this.resizeListener = () =>
        this.zone.run(() => this.onWindowResize(window.innerWidth));
      window.addEventListener('resize', this.resizeListener);
      this.beforePrintListener = () =>
        this.zone.run(() => {
          this.wasNavOpenBeforePrint = this.isNavOpen;
          this.closeNav();
        });
      window.addEventListener('beforeprint', this.beforePrintListener);
      this.afterPrintListener = () =>
        this.zone.run(() => {
          this.isNavOpen = this.wasNavOpenBeforePrint;
          this.cdr.markForCheck();
        });
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

    void this.handleLoadedWdoc(
      this.wdocLoaderService.fetchAndLoadWdoc(trimmedUrl)
    );
  }

  ngAfterViewInit(): void {
    const nativeViewer = this.viewer?.nativeElement;
    if (typeof ResizeObserver !== 'undefined' && nativeViewer) {
      this.resizeObserver = new ResizeObserver(() => {
        this.zone.run(() => this.fitContentToViewport());
      });
      this.resizeObserver.observe(nativeViewer);
    }
    this.fitContentToViewport(true);
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
    if (this.resizeObserver && this.viewer?.nativeElement) {
      this.resizeObserver.unobserve(this.viewer.nativeElement);
      this.resizeObserver.disconnect();
    }
    this.htmlProcessingService.cleanup();
  }

  onFileSelected(file: File) {
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const arrayBuffer = e.target?.result;
      if (arrayBuffer instanceof ArrayBuffer) {
        await this.handleLoadedWdoc(
          this.wdocLoaderService.loadWdocFromArrayBuffer(
            arrayBuffer,
            this.defaultTitle
          )
        );
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private setupFileHandler() {
    const w = window as any;

    if (!('launchQueue' in window)) {
      // Not supported (non-Chromium or not installed)
      return;
    }

    w.launchQueue.setConsumer(async (launchParams: any) => {
      if (!launchParams.files || !launchParams.files.length) {
        return;
      }

      for (const fileHandle of launchParams.files) {
        const file = await fileHandle.getFile(); // File object
        this.onFileSelected(file); // reuse your existing flow
      }
    });
  }

  toggleNav() {
    this.isNavOpen = !this.isNavOpen;
    this.fitContentToViewport();
  }

  closeNav() {
    this.isNavOpen = false;
    this.fitContentToViewport();
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
      this.dialogService.openAlert('Please drop a .wdoc or .zip file.', 'Invalid file');
      return;
    }
    this.onFileSelected(archiveFile);
  }

  onZoomChange(zoom: number) {
    this.zoom = this.clampZoom(zoom);
  }

  async onSaveForms() {
    if (
      !this.originalArrayBuffer ||
      !this.viewer ||
      !this.viewer.nativeElement
    ) {
      return;
    }
    await this.formManagerService.saveForms(
      this.viewer.nativeElement,
      this.originalArrayBuffer
    );
    this.showSave = false;
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
    this.cdr.markForCheck();
  }

  private applyResponsiveLayout(width: number) {
    const isDesktop = width >= 992;
    this.sidenavMode = isDesktop ? 'side' : 'over';
    if (isDesktop !== this.isDesktop) {
      this.isDesktop = isDesktop;
      this.isNavOpen = isDesktop;
    }
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
      this.cdr.markForCheck();
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

  private isSupportedArchive(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.endsWith('.wdoc') || lower.endsWith('.zip');
  }

  private async handleLoadedWdoc(
    resultPromise: Promise<WdocLoadResult | null>
  ) {
    const result = await resultPromise;
    if (!result) {
      return;
    }
    this.originalArrayBuffer = result.originalArrayBuffer;
    this.documentTitle = result.documentTitle;
    this.isEditing = false;
    this.attachments = result.attachments;
    this.formAnswers = result.formAnswers;
    this.showSave = false;
    this.htmlContent = this.sanitizer.bypassSecurityTrustHtml(result.html);
    if (!this.isDesktop) {
      this.isNavOpen = false;
    }
    this.fitContentToViewport(true);
    this.cdr.markForCheck();
  }

  onFormInteraction(): void {
    this.showSave = true;
  }

  startNewDocument(): void {
    this.isEditing = true;
    this.documentTitle = this.newDocumentTitle;
    this.editorContent = '<p>Start writing...</p>';
    this.showSave = true;
    this.cdr.markForCheck();
  }

  onEditorContentChange(content: string): void {
    this.editorContent = content;
    this.showSave = true;
  }

  async onSaveNewDocument(): Promise<void> {
    const content = this.editorContent?.trim()
      ? this.editorContent
      : '<p></p>';
    await this.documentCreatorService.downloadWdocFromHtml(content);
    this.showSave = false;
  }
}
