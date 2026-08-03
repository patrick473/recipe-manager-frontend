import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { markdown } from '@codemirror/lang-markdown';
import { EditorSelection, EditorState } from '@codemirror/state';
import { Decoration, EditorView, runScopeHandlers } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addLineDecorations,
  buildLivePreviewDecorations,
  MarkdownEditorComponent,
  toggleWrap,
} from './markdown-editor.component';

/** Runs the keymap binding matching `key` (e.g. 'Mod-b') as CodeMirror would on a real keydown. */
function runKeyBinding(view: EditorView, key: string): boolean {
  const eventKey = key.replace('Mod-', '');
  return runScopeHandlers(
    view,
    new KeyboardEvent('keydown', { key: eventKey, ctrlKey: true }),
    'editor',
  );
}

describe('MarkdownEditorComponent', () => {
  let fixture: ComponentFixture<MarkdownEditorComponent>;
  let component: MarkdownEditorComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MarkdownEditorComponent] });
    fixture = TestBed.createComponent(MarkdownEditorComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('mounts a CodeMirror view seeded with the value written before ngAfterViewInit ran', () => {
    component.writeValue('hello world');
    fixture.detectChanges();

    const view = component['view'];
    expect(view?.state.doc.toString()).toBe('hello world');
  });

  it('writeValue() treats null as an empty document', () => {
    component.writeValue(null);
    fixture.detectChanges();

    expect(component['view']?.state.doc.toString()).toBe('');
  });

  it('mounts without the live-preview plugin when sourceMode is already true', () => {
    component['sourceMode'].set(true);

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(component['view']).toBeTruthy();
  });

  describe('once mounted', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('writeValue() replaces the document when the new value differs', () => {
      component.writeValue('updated');

      expect(component['view']?.state.doc.toString()).toBe('updated');
    });

    it('writeValue() is a no-op when the value already matches the document', () => {
      component.writeValue('same');
      const view = component['view']!;
      const dispatchSpy = vi.spyOn(view, 'dispatch');

      component.writeValue('same');

      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('registerOnChange() wires up the change callback fired on document edits', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);

      component['view']!.dispatch({ changes: { from: 0, insert: 'x' } });

      expect(onChange).toHaveBeenCalledWith('x');
    });

    it('registerOnTouched() wires up the callback fired on blur', () => {
      const onTouched = vi.fn();
      component.registerOnTouched(onTouched);

      component['view']!.contentDOM.dispatchEvent(new FocusEvent('blur'));

      expect(onTouched).toHaveBeenCalledTimes(1);
    });

    it('setDisabledState(true) reconfigures the view to be read-only and non-editable', () => {
      component.setDisabledState(true);

      expect(component['disabled']()).toBe(true);
      expect(component['view']!.state.facet(EditorView.editable)).toBe(false);
      expect(component['view']!.state.readOnly).toBe(true);
    });

    it('toggleSourceMode() flips sourceMode() to true, then back to false on a second call', () => {
      expect(component['sourceMode']()).toBe(false);

      component['toggleSourceMode']();
      expect(component['sourceMode']()).toBe(true);

      component['toggleSourceMode']();
      expect(component['sourceMode']()).toBe(false);
    });

    it('toggleBold() wraps the current selection in ** via toggleWrap', () => {
      const view = component['view']!;
      view.dispatch({
        changes: { from: 0, insert: 'hi' },
        selection: EditorSelection.range(0, 2),
      });

      component['toggleBold']();

      expect(view.state.doc.toString()).toBe('**hi**');
    });

    it('toggleItalic() wraps the current selection in * via toggleWrap', () => {
      const view = component['view']!;
      view.dispatch({
        changes: { from: 0, insert: 'hi' },
        selection: EditorSelection.range(0, 2),
      });

      component['toggleItalic']();

      expect(view.state.doc.toString()).toBe('*hi*');
    });

    it('Mod-e toggles source mode via the keymap', () => {
      const view = component['view']!;

      expect(runKeyBinding(view, 'Mod-e')).toBe(true);

      expect(component['sourceMode']()).toBe(true);
    });

    it('Mod-b wraps the selection in ** via the keymap', () => {
      const view = component['view']!;
      view.dispatch({
        changes: { from: 0, insert: 'hi' },
        selection: EditorSelection.range(0, 2),
      });

      expect(runKeyBinding(view, 'Mod-b')).toBe(true);

      expect(view.state.doc.toString()).toBe('**hi**');
    });

    it('Mod-i wraps the selection in * via the keymap', () => {
      const view = component['view']!;
      view.dispatch({
        changes: { from: 0, insert: 'hi' },
        selection: EditorSelection.range(0, 2),
      });

      expect(runKeyBinding(view, 'Mod-i')).toBe(true);

      expect(view.state.doc.toString()).toBe('*hi*');
    });

    it('ngOnDestroy() destroys the CodeMirror view', () => {
      const view = component['view']!;
      const destroySpy = vi.spyOn(view, 'destroy');

      component.ngOnDestroy();

      expect(destroySpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('guards before the view is mounted', () => {
    it('setDisabledState() only sets the signal', () => {
      component.setDisabledState(true);

      expect(component['disabled']()).toBe(true);
      expect(component['view']).toBeNull();
    });

    it('toggleSourceMode() is a no-op', () => {
      component['toggleSourceMode']();

      expect(component['sourceMode']()).toBe(false);
    });

    it('toggleBold() is a no-op', () => {
      expect(() => component['toggleBold']()).not.toThrow();
    });

    it('toggleItalic() is a no-op', () => {
      expect(() => component['toggleItalic']()).not.toThrow();
    });

    it('ngOnDestroy() is a no-op when no view was created', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});

describe('MarkdownEditorComponent as a ControlValueAccessor bound via [formControl]', () => {
  @Component({
    imports: [ReactiveFormsModule, MarkdownEditorComponent],
    template: `<app-markdown-editor [formControl]="control" />`,
  })
  class HostComponent {
    readonly control = new FormControl('seeded');
  }

  it('resolves itself as the NG_VALUE_ACCESSOR and seeds the editor from the control value', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const hostFixture = TestBed.createComponent(HostComponent);
    hostFixture.detectChanges();

    const editor = hostFixture.debugElement.query(
      (de) => de.componentInstance instanceof MarkdownEditorComponent,
    ).componentInstance as MarkdownEditorComponent;

    expect(editor['view']?.state.doc.toString()).toBe('seeded');
  });
});

/**
 * These exercise `toggleWrap`/`buildLivePreviewDecorations`/`addLineDecorations`
 * directly against `EditorState`/`EditorView`, with no Angular `TestBed` and no
 * DOM mount — CodeMirror doesn't need a mounted view to build state or
 * decorations. Views are destroyed in `afterEach` so their async layout-measure
 * callback (unsupported by jsdom's `getClientRects`) never fires after the test
 * that created them has finished.
 */
describe('MarkdownEditorComponent pure helpers', () => {
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    view = null;
  });

  function collectDecorations(v: EditorView): { from: number; to: number; cls: string }[] {
    const out: { from: number; to: number; cls: string }[] = [];
    buildLivePreviewDecorations(v).between(0, v.state.doc.length, (from, to, value) => {
      out.push({ from, to, cls: (value as Decoration).spec['class'] });
    });
    return out;
  }

  describe('toggleWrap', () => {
    it('wraps the selection in the marker on both sides', () => {
      const state = EditorState.create({ doc: 'hello', selection: EditorSelection.range(0, 5) });
      view = new EditorView({ state });

      toggleWrap(view, '**');

      expect(view.state.doc.toString()).toBe('**hello**');
    });

    it('places the resulting selection around the wrapped text, not the markers', () => {
      const state = EditorState.create({ doc: 'hello', selection: EditorSelection.range(0, 5) });
      view = new EditorView({ state });

      toggleWrap(view, '**');

      expect(view.state.selection.main.from).toBe(2);
      expect(view.state.selection.main.to).toBe(7);
    });

    it('unwraps when the selection is already flanked by the marker', () => {
      const state = EditorState.create({
        doc: '**hello**',
        selection: EditorSelection.range(2, 7),
      });
      view = new EditorView({ state });

      toggleWrap(view, '**');

      expect(view.state.doc.toString()).toBe('hello');
      expect(view.state.selection.main.from).toBe(0);
      expect(view.state.selection.main.to).toBe(5);
    });

    it('round-trips: wrapping then wrapping again unwraps back to the original text', () => {
      const state = EditorState.create({ doc: 'hi', selection: EditorSelection.range(0, 2) });
      view = new EditorView({ state });

      toggleWrap(view, '*');
      expect(view.state.doc.toString()).toBe('*hi*');

      toggleWrap(view, '*');
      expect(view.state.doc.toString()).toBe('hi');
    });

    it('returns true so it can be used directly as a CodeMirror command', () => {
      const state = EditorState.create({ doc: 'x', selection: EditorSelection.range(0, 1) });
      view = new EditorView({ state });

      expect(toggleWrap(view, '*')).toBe(true);
    });
  });

  describe('buildLivePreviewDecorations', () => {
    it('dims a mark that is not on the line containing the cursor', () => {
      const doc = 'First line\nSome **bold** text.';
      const state = EditorState.create({
        doc,
        selection: EditorSelection.cursor(0),
        extensions: [markdown()],
      });
      view = new EditorView({ state });

      const decorations = collectDecorations(view);
      const markStart = doc.indexOf('**');
      const markEnd = doc.indexOf('bold') + 'bold'.length;

      expect(decorations).toContainEqual({
        from: markStart,
        to: markStart + 2,
        cls: 'cm-mark-dim',
      });
      expect(decorations).toContainEqual({ from: markEnd, to: markEnd + 2, cls: 'cm-mark-dim' });
    });

    it('does not dim a mark on the line the cursor is currently on', () => {
      const doc = 'First line\nSome **bold** text.';
      const cursorPos = doc.indexOf('bold');
      const state = EditorState.create({
        doc,
        selection: EditorSelection.cursor(cursorPos),
        extensions: [markdown()],
      });
      view = new EditorView({ state });

      const decorations = collectDecorations(view);

      expect(decorations.some((d) => d.cls === 'cm-mark-dim')).toBe(false);
    });

    it('always applies the styling class to emphasis content, regardless of cursor position', () => {
      const doc = 'First line\nSome **bold** text.';
      const state = EditorState.create({
        doc,
        selection: EditorSelection.cursor(0),
        extensions: [markdown()],
      });
      view = new EditorView({ state });

      const decorations = collectDecorations(view);
      const markStart = doc.indexOf('**');
      const markEnd = doc.indexOf('bold') + 'bold'.length + 2;

      expect(decorations).toContainEqual({ from: markStart, to: markEnd, cls: 'cm-strong' });
    });

    it('applies the em class to single-star emphasis content', () => {
      const doc = 'Some *italic* text.';
      const state = EditorState.create({
        doc,
        selection: EditorSelection.cursor(0),
        extensions: [markdown()],
      });
      view = new EditorView({ state });

      const decorations = collectDecorations(view);
      const markStart = doc.indexOf('*');
      const markEnd = doc.indexOf('italic') + 'italic'.length + 1;

      expect(decorations).toContainEqual({ from: markStart, to: markEnd, cls: 'cm-em' });
    });

    it('applies the inline-code class to backtick-delimited content', () => {
      const doc = 'Some `code` text.';
      const state = EditorState.create({
        doc,
        selection: EditorSelection.cursor(0),
        extensions: [markdown()],
      });
      view = new EditorView({ state });

      const decorations = collectDecorations(view);
      const markStart = doc.indexOf('`');
      const markEnd = doc.indexOf('code') + 'code'.length + 1;

      expect(decorations).toContainEqual({ from: markStart, to: markEnd, cls: 'cm-inline-code' });
    });

    it('applies the link class to a markdown link', () => {
      const doc = 'See [docs](https://example.com) for more.';
      const state = EditorState.create({
        doc,
        selection: EditorSelection.cursor(0),
        extensions: [markdown()],
      });
      view = new EditorView({ state });

      const decorations = collectDecorations(view);

      expect(decorations.some((d) => d.cls === 'cm-link')).toBe(true);
    });

    it('applies the list-mark and list-line classes to a list item', () => {
      const doc = '- item one';
      const state = EditorState.create({
        doc,
        selection: EditorSelection.cursor(doc.length),
        extensions: [markdown()],
      });
      view = new EditorView({ state });

      const decorations = collectDecorations(view);

      expect(decorations.some((d) => d.cls === 'cm-list-mark')).toBe(true);
      expect(decorations).toContainEqual({ from: 0, to: 0, cls: 'cm-list-line' });
    });

    it('applies the blockquote class to every line of a quoted block', () => {
      const doc = '> Quoted line';
      const state = EditorState.create({
        doc,
        selection: EditorSelection.cursor(doc.length),
        extensions: [markdown()],
      });
      view = new EditorView({ state });

      const decorations = collectDecorations(view);

      expect(decorations).toContainEqual({ from: 0, to: 0, cls: 'cm-blockquote' });
    });

    it('applies the code-block class to every line of a fenced code block', () => {
      const doc = '```\ncode here\n```';
      const state = EditorState.create({
        doc,
        selection: EditorSelection.cursor(0),
        extensions: [markdown()],
      });
      view = new EditorView({ state });

      const decorations = collectDecorations(view);

      expect(decorations.some((d) => d.cls === 'cm-code-block')).toBe(true);
    });

    it('applies a heading line class matching the heading level', () => {
      const doc = '## Section';
      const state = EditorState.create({
        doc,
        selection: EditorSelection.cursor(doc.length),
        extensions: [markdown()],
      });
      view = new EditorView({ state });

      const decorations = collectDecorations(view);

      expect(decorations).toContainEqual({ from: 0, to: 0, cls: 'cm-heading cm-h2' });
    });

    it('dims the heading mark once the cursor moves off the heading line', () => {
      const doc = '# Heading\n\nOther line';
      const cursorPos = doc.indexOf('Other');
      const state = EditorState.create({
        doc,
        selection: EditorSelection.cursor(cursorPos),
        extensions: [markdown()],
      });
      view = new EditorView({ state });

      const decorations = collectDecorations(view);

      expect(decorations).toContainEqual({ from: 0, to: 1, cls: 'cm-mark-dim' });
    });
  });

  describe('addLineDecorations', () => {
    it('adds one line decoration per line spanned by the [from, to) range', () => {
      const state = EditorState.create({ doc: 'line1\nline2\nline3' });
      const decorations: import('@codemirror/state').Range<Decoration>[] = [];

      addLineDecorations(decorations, state.doc, 0, state.doc.length, 'test-cls');

      expect(decorations).toHaveLength(3);
      expect(decorations.map((d) => d.from)).toEqual([0, 6, 12]);
      decorations.forEach((d) => expect(d.value.spec['class']).toBe('test-cls'));
    });

    it('adds a single line decoration when the range is within one line', () => {
      const state = EditorState.create({ doc: 'just one line' });
      const decorations: import('@codemirror/state').Range<Decoration>[] = [];

      addLineDecorations(decorations, state.doc, 2, 5, 'test-cls');

      expect(decorations).toHaveLength(1);
      expect(decorations[0].from).toBe(0);
    });
  });
});
