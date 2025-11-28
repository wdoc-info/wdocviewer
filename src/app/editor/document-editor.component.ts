import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Level } from '@tiptap/extension-heading';

@Component({
  selector: 'app-document-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-editor.component.html',
  styleUrls: ['./document-editor.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DocumentEditorComponent
  implements AfterViewInit, OnDestroy, OnChanges
{
  @Input() content = '<p>Start writing...</p>';
  @Output() contentChange = new EventEmitter<string>();
  @ViewChild('editorHost') editorHost?: ElementRef<HTMLElement>;

  editor?: Editor;
  private pendingExternalUpdate = false;
  pageHeight = 1122;
  pageWidth = 793.8;
  pagePadding = 20;
  private pageGap = 20;
  pageCount = 1;
  private resizeObserver?: ResizeObserver;
  private paginationRaf = 0;
  private placeholderCleared = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['content'] &&
      this.editor &&
      typeof changes['content'].currentValue === 'string'
    ) {
      const currentHtml = this.editor.getHTML();
      if (currentHtml !== this.content) {
        this.pendingExternalUpdate = true;
        this.editor.commands.setContent(this.content, { emitUpdate: false });
        queueMicrotask(() => (this.pendingExternalUpdate = false));
        this.schedulePaginationUpdate();
      }
    }

    if (changes['content']) {
      this.placeholderCleared = this.content !== '<p>Start writing...</p>';
    }
  }

  ngAfterViewInit(): void {
    this.placeholderCleared = this.content !== '<p>Start writing...</p>';

    if (this.editorHost) {
      this.editor = new Editor({
        element: this.editorHost.nativeElement,
        extensions: [StarterKit],
        content: this.content,
        onUpdate: ({ editor }: { editor: Editor }) => {
          if (this.pendingExternalUpdate) {
            return;
          }
          this.contentChange.emit(editor.getHTML());
          this.schedulePaginationUpdate();
        },
        onFocus: ({ editor }: { editor: Editor }) => {
          if (this.placeholderCleared) {
            return;
          }

          const currentHtml = editor.getHTML().trim();
          if (currentHtml === '<p>Start writing...</p>') {
            this.placeholderCleared = true;
            editor.commands.setContent('<p></p>');
            this.schedulePaginationUpdate();
          }
        },
      });
    }
    this.observeEditorHeight();
    this.schedulePaginationUpdate();
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
    this.resizeObserver?.disconnect();
    if (this.paginationRaf) {
      cancelAnimationFrame(this.paginationRaf);
      this.paginationRaf = 0;
    }
  }

  toggleBold() {
    this.editor?.chain().focus().toggleBold().run();
  }

  toggleItalic() {
    this.editor?.chain().focus().toggleItalic().run();
  }

  toggleBulletList() {
    this.editor?.chain().focus().toggleBulletList().run();
  }

  toggleOrderedList() {
    this.editor?.chain().focus().toggleOrderedList().run();
  }

  setHeading(level: Level) {
    this.editor?.chain().focus().toggleHeading({ level }).run();
  }

  isActive(name: string, attrs?: Record<string, unknown>) {
    return this.editor?.isActive(name, attrs) ?? false;
  }

  get pageCountArray(): number[] {
    return Array.from({ length: this.pageCount }, (_v, i) => i);
  }

  get pageStackHeight(): number {
    return this.pageCount * (this.pageHeight + this.pageGap);
  }

  private observeEditorHeight(): void {
    if (!this.editorHost?.nativeElement || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => this.schedulePaginationUpdate());
    this.resizeObserver.observe(this.editorHost.nativeElement);
  }

  private schedulePaginationUpdate(): void {
    if (this.paginationRaf) {
      cancelAnimationFrame(this.paginationRaf);
    }
    this.paginationRaf = requestAnimationFrame(() => {
      this.paginationRaf = 0;
      this.updatePagination();
    });
  }

  private updatePagination(): void {
    const host = this.editorHost?.nativeElement;
    if (!host) {
      return;
    }

    const usableHeight = this.pageHeight - this.pagePadding * 2;
    const totalHeight = host.scrollHeight;
    const pageStride = usableHeight + this.pageGap;
    const nextPageCount = Math.max(
      1,
      Math.ceil((totalHeight + this.pageGap) / pageStride),
    );

    if (nextPageCount !== this.pageCount) {
      this.pageCount = nextPageCount;
    }
  }
}
