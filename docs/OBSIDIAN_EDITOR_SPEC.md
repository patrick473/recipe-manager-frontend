# Recipe Editor Overhaul: Obsidian-style editing

Design spec for reworking recipe create/edit (`RecipeFormComponent`) toward
an Obsidian-like writing experience, scoped to two pieces: live-preview
editing (markdown renders inline as you type, not a raw textarea) and a
Tags & Properties panel (a small structured metadata block above the body,
styled like Obsidian's Properties UI).

**Explicitly out of scope:** wikilinks/backlinks between recipes, command
palette/quick switcher, graph view, vim mode — real Obsidian features, but
they change the data model (linking) or app-wide navigation (palette)
rather than the editor itself; worth their own spec later.

## Shape of the change

**Live preview editing:** New shared `MarkdownEditorComponent` wrapping
[CodeMirror 6](https://codemirror.net/) (what Obsidian itself is built on),
implementing `ControlValueAccessor` so it drops into the existing
`ReactiveFormsModule` usage with no changes to `RecipeFormComponent`'s form
group, validation, or submit logic. Headings/bold/italic/code/quotes/fenced
code render with real styling in place; syntax marks (`#`, `**`, etc.) dim
to a low-opacity hint elsewhere and become fully visible/editable only on
the cursor's line — a rendering layer over plain text, not
contentEditable/rich-text. A toggle (button + Ctrl/Cmd+E) switches to
Source mode (plain text, no decorations); the underlying form value is
identical either way. Live-preview decorations use a `ViewPlugin` walking
the syntax tree `@codemirror/lang-markdown`'s Lezer grammar already
produces, applying widget/mark `Decoration`s — a well-trodden pattern with
existing OSS references to adapt rather than building the syntax-tree
walker from scratch. Editor theme reads the same `--color-*` custom
properties as the rest of the app, so light/dark tracks `ThemeService`
automatically. Editor grows with content rather than internally scrolling.
No separate preview page; `RecipeDetailComponent`'s final render is
unchanged.

**Tags & Properties panel:** Fixed set of typed fields, not arbitrary keys
(arbitrary keys would mean an untyped JSON blob, breaking from this app's
hand-typed-DTO convention) — `tags: string[]` (removable pill chips +
autocomplete against tags used on other recipes),
`prepTimeMinutes`/`cookTimeMinutes`/`servings: number | null` (plain number
inputs). Shown in both `RecipeFormComponent` (editable) and
`RecipeDetailComponent` (read-only chips + label/value rows), above
`.markdown-body`, styled as a bordered box with a muted label column,
collapsible via a chevron. Backend: new nullable columns on `Recipe`
(`tags` as `@ElementCollection List<String>` via a join table — no separate
`Tag` entity since search/filtering isn't in scope), matching
`openapi.yaml`/DTO additions with `@Min(0)`/`@Size(max = 20)` validation; no
migration needed against dev's `ddl-auto=update` H2 (not safe for a real
Postgres prod deploy). Frontend: new `PropertiesPanelComponent` (external
per `CODE_STYLE_SPEC.md`'s ~20-line threshold), wired into both components'
typed form groups / read-only render.

Sequencing: backend fields land first (unlocks everything else) →
`api:generate` + properties panel end-to-end → read-only render on detail
page → CodeMirror editor last and isolated, as the highest-risk, most novel
piece that shouldn't block the simpler properties work.

## Deferred

Tag filter on the recipe list, wikilinks between recipes, command palette.
