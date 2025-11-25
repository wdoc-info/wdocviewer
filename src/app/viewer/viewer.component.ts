import {
  Component,
  Input,
  AfterViewInit,
  ElementRef,
  ViewChild,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerComponent implements AfterViewInit, OnChanges {
  @Input() htmlContent: SafeHtml | null = null;
  @Input() zoom = 100;
  @Output() formInteraction = new EventEmitter<void>();
  @ViewChild('contentContainer') contentContainer?: ElementRef;
  @ViewChild('scrollContainer') scrollContainer?: ElementRef;
  private viewInitialized = false;
  private pendingZoomRefresh = false;

  ngAfterViewInit() {
    this.viewInitialized = true;
    this.applyZoom();
    if (this.pendingZoomRefresh) {
      this.pendingZoomRefresh = false;
      this.scheduleZoomRefresh();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['zoom'] && this.viewInitialized) {
      this.applyZoom();
    }
    if (changes['htmlContent'] && this.viewInitialized) {
      this.scheduleZoomRefresh();
    } else if (changes['htmlContent']) {
      this.pendingZoomRefresh = true;
    }
  }

  get nativeElement(): HTMLElement | undefined {
    return this.contentContainer?.nativeElement as HTMLElement;
  }

  onFormInteraction(): void {
    this.formInteraction.emit();
  }

  private applyZoom() {
    const container = this.contentContainer
      ?.nativeElement as HTMLElement | null;
    if (!container) {
      return;
    }
    const scale = Math.max(10, this.zoom) / 100;

    const pages = Array.from(
      container.querySelectorAll('wdoc-page')
    ) as HTMLElement[];

    pages.forEach((page) => {
      page.style.zoom = `${scale}`;
    });
  }

  private scheduleZoomRefresh(): void {
    queueMicrotask(() => this.applyZoom());
  }
}
