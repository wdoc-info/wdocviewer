import { Component, Input, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.css'],
})
export class ViewerComponent implements AfterViewInit {
  @Input() htmlContent: SafeHtml | null = null;
  @ViewChild('contentContainer') contentContainer!: ElementRef;

  ngAfterViewInit() {
    // scaling or other operations could go here
  }
}
