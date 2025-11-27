import {
  AfterViewInit,
  Component,
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
})
export class DocumentEditorComponent
  implements AfterViewInit, OnDestroy, OnChanges
{
  @Input() content = '<p>Start writing...</p>';
  @Output() contentChange = new EventEmitter<string>();
  @ViewChild('editorHost') editorHost?: ElementRef<HTMLElement>;

  editor?: Editor;
  private pendingExternalUpdate = false;

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
      }
    }
  }

  ngAfterViewInit(): void {
    if (this.editorHost) {
      this.editor = new Editor({
        element: this.editorHost.nativeElement,
        extensions: [StarterKit],
        content: this.content,
        onUpdate: ({ editor }) => {
          if (this.pendingExternalUpdate) {
            return;
          }
          this.contentChange.emit(editor.getHTML());
        },
      });
    }
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
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
}
