import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewEncapsulation,
  forwardRef,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownKeymap } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { Compartment, EditorSelection, EditorState, Range } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  KeyBinding,
  ViewPlugin,
  ViewUpdate,
  keymap,
} from '@codemirror/view';
import type { SyntaxNodeRef } from '@lezer/common';

/**
 * Syntax "mark" node names (delimiters like `#`, `**`, `` ` ``, `[]()`, `>`) that
 * should render at low opacity everywhere *except* on the line the cursor is
 * currently on — the core Obsidian Live Preview behavior. The underlying text
 * is never removed, only dimmed, so click-to-place-cursor and editing keep
 * working exactly like plain text.
 */
const DIM_MARK_NODES = new Set([
  'HeaderMark',
  'EmphasisMark',
  'CodeMark',
  'QuoteMark',
  'LinkMark',
  'URL',
]);

const ATX_HEADING_RE = /^ATXHeading([1-6])$/;

/** Applies `cls` as a line decoration to every line the [from, to) range spans. */
export function addLineDecorations(
  decorations: Range<Decoration>[],
  doc: EditorState['doc'],
  from: number,
  to: number,
  cls: string,
): void {
  const lineDeco = Decoration.line({ class: cls });
  let pos = from;
  for (;;) {
    const line = doc.lineAt(pos);
    decorations.push(lineDeco.range(line.from));
    if (line.to >= to) break;
    pos = line.to + 1;
  }
}

/**
 * Walks the markdown syntax tree over the visible ranges and builds the
 * decoration set for Live Preview mode: real heading/emphasis/code/link/quote
 * styling everywhere, with the raw syntax marks dimmed unless they're on the
 * line containing the cursor.
 */
export function buildLivePreviewDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const decorations: Range<Decoration>[] = [];
  const activeLine = state.doc.lineAt(state.selection.main.head).number;

  const isOnActiveLine = (node: SyntaxNodeRef): boolean => {
    const startLine = state.doc.lineAt(node.from).number;
    const endLine = state.doc.lineAt(node.to).number;
    return activeLine >= startLine && activeLine <= endLine;
  };

  const addMark = (from: number, to: number, cls: string): void => {
    decorations.push(Decoration.mark({ class: cls }).range(from, to));
  };

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const headingMatch = ATX_HEADING_RE.exec(node.name);
        if (headingMatch) {
          addLineDecorations(
            decorations,
            state.doc,
            node.from,
            node.to,
            `cm-heading cm-h${headingMatch[1]}`,
          );
          return;
        }

        if (DIM_MARK_NODES.has(node.name)) {
          if (!isOnActiveLine(node)) addMark(node.from, node.to, 'cm-mark-dim');
          return;
        }

        switch (node.name) {
          case 'StrongEmphasis':
            addMark(node.from, node.to, 'cm-strong');
            break;
          case 'Emphasis':
            addMark(node.from, node.to, 'cm-em');
            break;
          case 'InlineCode':
            addMark(node.from, node.to, 'cm-inline-code');
            break;
          case 'Link':
            addMark(node.from, node.to, 'cm-link');
            break;
          case 'ListMark':
            addMark(node.from, node.to, 'cm-list-mark');
            break;
          case 'ListItem':
            addLineDecorations(decorations, state.doc, node.from, node.to, 'cm-list-line');
            break;
          case 'Blockquote':
            addLineDecorations(decorations, state.doc, node.from, node.to, 'cm-blockquote');
            break;
          case 'FencedCode':
            addLineDecorations(decorations, state.doc, node.from, node.to, 'cm-code-block');
            break;
        }
      },
    });
  }

  return Decoration.set(decorations, true);
}

/**
 * Obsidian-style "Live Preview" decorations. Rebuilt whenever the document,
 * selection, or viewport changes. Purely a rendering layer — never touches
 * the document text.
 */
const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildLivePreviewDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildLivePreviewDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

/**
 * Wraps (or unwraps, if already wrapped) every selection range in `marker`
 * on both sides — e.g. `toggleWrap(view, '**')` for bold. There's no built-in
 * "wrap selection" command in `@codemirror/commands`, so this is hand-rolled.
 */
export function toggleWrap(view: EditorView, marker: string): boolean {
  const { state } = view;
  const tr = state.changeByRange((range) => {
    const { from, to } = range;
    const before = state.sliceDoc(Math.max(0, from - marker.length), from);
    const after = state.sliceDoc(to, to + marker.length);

    if (before === marker && after === marker) {
      return {
        changes: [
          { from: from - marker.length, to: from },
          { from: to, to: to + marker.length },
        ],
        range: EditorSelection.range(from - marker.length, to - marker.length),
      };
    }

    return {
      changes: [
        { from, insert: marker },
        { from: to, insert: marker },
      ],
      range: EditorSelection.range(from + marker.length, to + marker.length),
    };
  });

  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: 'input' }));
  view.focus();
  return true;
}

/**
 * Theme driven entirely by `var(--color-*)` custom properties from
 * `_tokens.scss` — a single theme object tracks `ThemeService`'s
 * `data-theme` swap automatically, no separate dark variant to maintain.
 */
const editorTheme = EditorView.theme({
  '&': {
    color: 'var(--color-text)',
    backgroundColor: 'var(--color-surface)',
    fontSize: 'var(--font-size-base)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
  },
  '&.cm-focused': {
    outline: 'none',
    borderColor: 'var(--color-primary)',
  },
  '.cm-content': {
    fontFamily: 'var(--font-sans)',
    padding: 'var(--space-4)',
    caretColor: 'var(--color-text)',
  },
  '.cm-line': {
    padding: '0',
  },
});

/**
 * Obsidian-style Live Preview markdown editor built on CodeMirror 6.
 *
 * Implements `ControlValueAccessor` so it drops into `ReactiveFormsModule`
 * with `formControlName="content"`, with zero changes required to the host
 * form's group/validation/submit logic.
 */
@Component({
  selector: 'app-markdown-editor',
  templateUrl: './markdown-editor.component.html',
  styleUrl: './markdown-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // CodeMirror mounts its view imperatively into `editorHost`, outside Angular's
  // template compiler, so emulated encapsulation's `_ngcontent` attribute never
  // lands on its generated DOM — styling `.cm-*` elements requires either
  // `::ng-deep` or (preferred here) turning encapsulation off, scoped safely by
  // nesting every selector under the component's own `.md-editor` root class.
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MarkdownEditorComponent),
      multi: true,
    },
  ],
})
export class MarkdownEditorComponent implements AfterViewInit, OnDestroy, ControlValueAccessor {
  private readonly editorHost = viewChild.required<ElementRef<HTMLDivElement>>('editorHost');

  protected readonly sourceMode = signal(false);
  protected readonly disabled = signal(false);

  private view: EditorView | null = null;
  private pendingValue: string | null = null;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  private readonly livePreviewCompartment = new Compartment();
  private readonly editableCompartment = new Compartment();
  private readonly readOnlyCompartment = new Compartment();

  ngAfterViewInit(): void {
    const doc = this.pendingValue ?? '';

    const keyBindings: KeyBinding[] = [
      {
        key: 'Mod-e',
        run: (v) => {
          this.setSourceMode(!this.sourceMode(), v);
          return true;
        },
      },
      { key: 'Mod-b', run: (v) => toggleWrap(v, '**') },
      { key: 'Mod-i', run: (v) => toggleWrap(v, '*') },
      ...markdownKeymap,
      ...historyKeymap,
      ...defaultKeymap,
    ];

    const state = EditorState.create({
      doc,
      extensions: [
        history(),
        keymap.of(keyBindings),
        markdown(),
        EditorView.lineWrapping,
        this.livePreviewCompartment.of(this.sourceMode() ? [] : [livePreviewPlugin]),
        this.editableCompartment.of(EditorView.editable.of(!this.disabled())),
        this.readOnlyCompartment.of(EditorState.readOnly.of(this.disabled())),
        editorTheme,
        EditorView.domEventHandlers({
          blur: () => {
            this.onTouched();
            return false;
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.onChange(update.state.doc.toString());
          }
        }),
      ],
    });

    this.view = new EditorView({ state, parent: this.editorHost().nativeElement });
    this.pendingValue = null;
  }

  ngOnDestroy(): void {
    this.view?.destroy();
  }

  writeValue(value: string | null): void {
    const next = value ?? '';
    if (!this.view) {
      this.pendingValue = next;
      return;
    }

    const current = this.view.state.doc.toString();
    if (current === next) return;

    this.view.dispatch({
      changes: { from: 0, to: current.length, insert: next },
    });
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    if (!this.view) return;

    this.view.dispatch({
      effects: [
        this.editableCompartment.reconfigure(EditorView.editable.of(!isDisabled)),
        this.readOnlyCompartment.reconfigure(EditorState.readOnly.of(isDisabled)),
      ],
    });
  }

  protected toggleSourceMode(): void {
    if (!this.view) return;
    this.setSourceMode(!this.sourceMode(), this.view);
  }

  protected toggleBold(): void {
    if (this.view) toggleWrap(this.view, '**');
  }

  protected toggleItalic(): void {
    if (this.view) toggleWrap(this.view, '*');
  }

  private setSourceMode(next: boolean, view: EditorView): void {
    this.sourceMode.set(next);
    view.dispatch({
      effects: this.livePreviewCompartment.reconfigure(next ? [] : [livePreviewPlugin]),
    });
    view.focus();
  }
}
