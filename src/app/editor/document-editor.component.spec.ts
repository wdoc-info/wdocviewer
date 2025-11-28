import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { DocumentEditorComponent } from './document-editor.component';

describe('DocumentEditorComponent', () => {
  let fixture: ComponentFixture<DocumentEditorComponent>;
  let component: DocumentEditorComponent;
  const flushRaf = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const settle = async () => {
    await fixture.whenStable();
    await flushRaf();
    fixture.detectChanges();
    await flushRaf();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  });

  it('emits content changes when the document updates', async () => {
    const emitSpy = spyOn(component.contentChange, 'emit');
    component.editor?.commands.setContent('<p>Updated</p>');
    await flushRaf();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('updates the live document when the input content changes', async () => {
    component.content = '<p>Reset</p>';
    component.ngOnChanges({
      content: new SimpleChange(undefined, component.content, false),
    });

    await settle();

    expect(component.editor?.getHTML()).toContain('Reset');
  });

  it('exposes basic formatting commands', async () => {
    component.toggleBold();
    component.toggleItalic();
    component.toggleBulletList();
    component.toggleOrderedList();
    component.setHeading(2);

    await settle();
    expect(component.editor?.isActive('heading', { level: 2 })).toBeTrue();
  });

  it('clears the placeholder when the editor gains focus', async () => {
    const editor = component.editor!;
    editor.options.onFocus?.({ editor } as any);

    await settle();
    expect(editor.getHTML()).toBe('<p></p>');
  });

  it('paginates content when the available height is exceeded', async () => {
    component.pageHeight = 120;
    component.content = `<p>${'line<br>'.repeat(200)}</p>`;
    component.ngOnChanges({
      content: new SimpleChange(undefined, component.content, false),
    });

    await settle();
    expect(component.pageContents.length).toBeGreaterThan(1);
  });
});
