import {
  Component,
  Input,
  AfterViewInit,
  ElementRef,
  ViewChild,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.css'],
})
export class ViewerComponent implements AfterViewInit, OnChanges {
  @Input() htmlContent: SafeHtml | null = null;
  @Input() zoom = 100;
  @ViewChild('contentContainer') contentContainer?: ElementRef;
  @ViewChild('scrollContainer') scrollContainer?: ElementRef;
  private viewInitialized = false;

  ngAfterViewInit() {
    this.viewInitialized = true;
    this.applyZoom();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['zoom'] && this.viewInitialized) {
      this.applyZoom();
    }
    if (changes['htmlContent'] && this.viewInitialized) {
      setTimeout(() => this.applyZoom());
    }
  }

  get nativeElement(): HTMLElement | undefined {
    return this.contentContainer?.nativeElement as HTMLElement;
  }

  get scrollElement(): HTMLElement | undefined {
    return this.scrollContainer?.nativeElement as HTMLElement;
  }

  private applyZoom() {
    const container = this.contentContainer?.nativeElement as HTMLElement | null;
    if (!container) {
      return;
    }
    const scale = Math.max(10, this.zoom) / 100;
    container.style.setProperty('--viewer-scale', `${scale}`);

    const pages = Array.from(
      container.querySelectorAll('wdoc-page')
    ) as HTMLElement[];

    if (pages.length === 0) {
      container.style.zoom = `${scale}`;
      container.style.transform = '';
      return;
    }

    container.style.zoom = '';
    container.style.transform = '';
    pages.forEach((page) => {
      page.style.transform = '';
      page.style.transformOrigin = 'top center';
      page.style.zoom = `${scale}`;
    });
  }
}
