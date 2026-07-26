# Recipe Editor Overhaul: Obsidian-style editing

Design spec for reworking recipe create/edit (`RecipeFormComponent`) toward an
Obsidian-like writing experience. Scope was narrowed deliberately to two
pieces:

1. **Live preview editing** — markdown renders inline as you type, instead of
   a raw `<textarea>` with no styling until you save and view the read page.
2. **Tags & Properties panel** — a small structured metadata block above the
   freeform body, styled like Obsidian's Properties UI.

**Explicitly out of scope for this pass:** wikilinks/backlinks between
recipes, command palette / quick switcher, graph view, vim mode. These are
real Obsidian features but change the data model (linking) or app-wide
navigation (palette) rather than the editor itself — worth their own spec
later if wanted.

---

## Current state (baseline)

- `RecipeFormComponent` ([recipe-form.component.html](../src/app/components/recipe-form/recipe-form.component.html)) has three fields: `title`, `description`, `content`. `content` is a plain `<textarea formControlName="content" rows="16">` — no syntax styling, no preview, while editing.
- Rendered markdown only appears after saving, on `RecipeDetailComponent`, via `marked.parse()` + `DomSanitizer.bypassSecurityTrustHtml`, styled by the global `.markdown-body` class ([_markdown.scss](../src/styles/_markdown.scss)).
- No metadata fields exist beyond `title`/`description`/`content` — `RecipeRequest`/`RecipeResponse` in `openapi.yaml` are the full data model, hand-typed (no arbitrary JSON blobs), and the generated TS types mirror that.
- Design tokens (`_tokens.scss`) already define a full light/dark palette via CSS custom properties (`--color-*`, `--space-*`, `--radius-*`), swapped by `ThemeService` setting `data-theme` on `<html>` — any new UI should consume these, not hardcode colors.

---

## Part 1 — Live preview editing

### Behavior

Replace the raw textarea with a single continuous editing surface that
renders markdown inline as you type, following Obsidian's "Live Preview"
convention:

- `# Heading` renders at real heading size/weight; the `#` marks and other
  syntax characters (`**`, `_`, `` ` ``, `[]()`) dim down to a low-opacity
  hint and only turn fully visible/editable when the cursor is on that line.
  Elsewhere in the document they stay decorated.
- `**bold**`, `*italic*`, `` `code` `` render with real styling in place.
- `- item` / `1. item` get real bullet/number glyphs and indentation, but the
  underlying text stays plain and editable — this is a rendering layer over
  the text, not a rich-text/contentEditable model.
- `> quote` gets the same left-border treatment as `.markdown-body
  blockquote`.
- Fenced code blocks get the same monospace/background treatment as
  `.markdown-body pre`.
- A toggle (button + `Ctrl/Cmd+E`) switches to **Source mode**: plain
  markdown text, no decorations — for people who want to paste/edit raw
  markdown without the live rendering fighting them. Same underlying string
  either way; toggling doesn't touch the form control's value.
- Editor grows with content (like the current `rows="16"` textarea's
  min-height, ~320px) rather than becoming an internally-scrolling box —
  keeps the "one continuous document" feel Obsidian has, instead of a
  boxed-in form field.
- No more separate "preview" page during editing — `RecipeDetailComponent`
  (the read view after saving) is unchanged and keeps using `marked.parse()`
  for the final static render.

### Implementation

New shared component: `MarkdownEditorComponent`
(`src/app/shared/markdown-editor/markdown-editor.component.{ts,html,scss}`),
wrapping [CodeMirror 6](https://codemirror.net/) (what Obsidian itself is
built on).

- Implements `ControlValueAccessor` so it drops straight into the existing
  `ReactiveFormsModule` usage — `<app-markdown-editor formControlName="content">`
  replaces the `<textarea>` with **no changes** to `RecipeFormComponent`'s
  form group, validation, or submit logic.
- New dependencies: `codemirror`, `@codemirror/view`, `@codemirror/state`,
  `@codemirror/language`, `@codemirror/lang-markdown`, `@codemirror/commands`.
- **Live-preview decorations** (the hard part): a `ViewPlugin` walking the
  syntax tree that `@codemirror/lang-markdown`'s Lezer grammar already
  produces, using widget/mark `Decoration`s to hide heading/emphasis/link
  marks outside the line containing the cursor, and to apply heading/bold/
  italic/code CSS classes to the rendered spans. This is a well-trodden
  pattern (several OSS "Obsidian-style live preview for CodeMirror 6"
  implementations exist to reference) — plan to adapt one rather than
  writing the syntax-tree walker from scratch.
- Theme: `EditorView.theme({...})` reading the same `--color-*` custom
  properties as the rest of the app, so light/dark mode tracks
  `ThemeService`'s `data-theme` attribute automatically with no separate
  editor-specific dark theme to maintain.
- Optional small toolbar (Bold/Italic/Link/Checklist) above the editor,
  calling CodeMirror commands, each mirrored by a `keymap.of([...])` binding
  (`Ctrl+B`, `Ctrl+I`, ...). Nice-to-have, not required for the core
  live-preview behavior.

### Files touched

- New: `src/app/shared/markdown-editor/markdown-editor.component.{ts,html,scss}`
- [recipe-form.component.html](../src/app/components/recipe-form/recipe-form.component.html): swap the `<textarea>` field for `<app-markdown-editor formControlName="content">`
- [recipe-form.component.ts](../src/app/components/recipe-form/recipe-form.component.ts): import `MarkdownEditorComponent`
- `package.json`: add the CodeMirror packages above

---

## Part 2 — Tags & Properties panel

### Behavior

A small block between the title/description fields and the content editor —
Obsidian's Properties panel, scoped to a **fixed set of typed fields** rather
than arbitrary keys (arbitrary keys would mean an untyped JSON blob in the
API, which breaks from this app's existing hand-typed-DTO convention):

| Field             | Type            | Rendered as                                   |
|-------------------|-----------------|------------------------------------------------|
| `tags`            | `string[]`      | removable pill chips + "+ tag" add input, autocompleting against tags already used on other recipes |
| `prepTimeMinutes` | `number \| null`| plain number input                            |
| `cookTimeMinutes` | `number \| null`| plain number input                            |
| `servings`        | `number \| null`| plain number input                            |

Shown in both `RecipeFormComponent` (editable) and `RecipeDetailComponent`
(read-only render: chips + compact label/value rows), directly above
`.markdown-body`, styled as a bordered box (`--color-border`,
`--radius-md`) with a muted label column, matching Obsidian's compact
property-table look. Collapsible via a chevron, default expanded.

### Backend changes

- `openapi.yaml`: add `tags` (array of string), `prepTimeMinutes`,
  `cookTimeMinutes`, `servings` (nullable integers, `minimum: 0`) to both
  `RecipeRequest` and `RecipeResponse`.
- [Recipe.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/model/Recipe.java): add `prepTimeMinutes`/`cookTimeMinutes`/`servings` as nullable `Integer` columns; `tags` as `@ElementCollection List<String>` (simplest JPA mapping for a string list via a `recipe_tags` join table — no separate `Tag` entity needed since tag search/filtering isn't in scope here).
- [RecipeRequest.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/dto/RecipeRequest.java) / `RecipeResponse.java`: add matching fields, `@Min(0)` on the numeric ones, `@Size(max = 20)` on `tags`.
- `RecipeService`: extend the entity↔DTO mapping with the new fields.
- No migration needed for dev — `spring.jpa.hibernate.ddl-auto=update` picks up new columns automatically against H2. Worth a one-line callout that this is not a safe strategy for a real Postgres prod deploy (consistent with `CLAUDE.md`'s existing note that prod/dev datasource switching is already manual, not profile-driven).
- **After backend changes**, run `npm run api:generate` in the frontend per the existing `CLAUDE.md` rule — regenerates `RecipeRequest`/`RecipeResponse` models and `recipes.service.ts` before touching any consuming code.

### Frontend changes

- New shared component `PropertiesPanelComponent` (goes external per the
  ~20-line inline/external threshold in `CODE_STYLE_SPEC.md` — a tag-chip
  editor plus three number inputs comfortably exceeds that).
- `RecipeFormComponent`: extend the typed form group —
  `tags: FormControl<string[]>`, `prepTimeMinutes`/`cookTimeMinutes`/`servings: FormControl<number | null>`.
- `RecipeDetailComponent`: render the read-only properties block straight
  from `RecipeResponse`, above `.markdown-body`.
- `recipe.model.ts`: no manual change — it re-exports the generated types,
  which pick up the new fields automatically once `api:generate` reruns.
- *Optional stretch, not required for this spec*: show tag chips on
  `RecipeListComponent` cards, since tags now exist on every recipe.

---

## Suggested sequencing

1. Backend: add the four fields to entity/DTOs/`openapi.yaml` — small,
   mechanical, unlocks everything else.
2. Frontend: `npm run api:generate`, build `PropertiesPanelComponent`, wire
   it into `RecipeFormComponent`'s create/edit form. Ships tags/properties
   end-to-end without touching the editor at all.
3. Add the read-only properties render to `RecipeDetailComponent`.
4. Build `MarkdownEditorComponent` (CodeMirror 6) as its own isolated
   change, swapped into `RecipeFormComponent` last — it's the highest-risk,
   most novel piece and shouldn't block the (simpler, more valuable)
   properties work above.
5. Follow-ups, deliberately deferred: tag filter on the recipe list,
   wikilinks between recipes, command palette.
