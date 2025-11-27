import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { DocumentEditorComponent } from './document-editor.component';

describe('DocumentEditorComponent', () => {
  let fixture: ComponentFixture<DocumentEditorComponent>;
  let component: DocumentEditorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits content changes when the document updates', () => {
    const emitSpy = spyOn(component.contentChange, 'emit');
    component.editor?.commands.setContent('<p>Updated</p>');
    expect(emitSpy).toHaveBeenCalled();
  });

  it('updates the live document when the input content changes', () => {
    component.content = '<p>Reset</p>';
    component.ngOnChanges({
      content: new SimpleChange(undefined, component.content, false),
    });

    expect(component.editor?.getHTML()).toContain('Reset');
  });

  it('exposes basic formatting commands', () => {
    component.toggleBold();
    component.toggleItalic();
    component.toggleBulletList();
    component.toggleOrderedList();
    component.setHeading(2);

    expect(component.editor?.isActive('heading', { level: 2 })).toBeTrue();
  });
});
