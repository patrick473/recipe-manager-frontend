# Frontend Coding Style Spec

Findings from a review of `recipe-manager-frontend/src` (2026-07-25), and the
changes needed to bring the codebase to one consistent style. No linter or
formatter was configured at the time — the root cause of most
inconsistencies below; several resolved automatically once tooling was in
place, the rest needed one-time manual convergence.

Priority key: **P0** — pick one convention now, before more components copy
the wrong one · **P1** — should fix soon, moderate churn · **P2** — nice to
have, low urgency.

---

## P0 — Tooling gap ✅ Resolved

There was nothing enforcing style before this; every inconsistency in this
doc is a symptom of that.

- [x] Add `@angular-eslint/*` + `eslint` + `typescript-eslint`, with a flat
      `eslint.config.js` (Angular CLI ≥19 scaffolds this via
      `ng add @angular-eslint/schematics`).
- [x] Add `prettier` + `prettier-plugin-organize-imports` (or equivalent),
      with a `.prettierrc` pinning `singleQuote: true`, `printWidth`, and
      Angular HTML formatting.
- [x] Add `npm run lint` / `npm run format` scripts and run both once,
      repo-wide, to eliminate whitespace/indentation drift before doing
      anything else.
- [ ] Wire lint into CI so drift doesn't reaccumulate. _(Not done — no CI
      pipeline exists in this repo yet; `npm run lint`/`npm run format`
      remain a manual pre-PR step.)_

## P0 — Dependency injection: `inject()` vs constructor injection ✅ Resolved

Both styles were in use, sometimes in the same class (e.g.
`recipe-list.component.ts` mixed `inject()` for one service with
constructor injection for others).

**Convention to adopt:** `inject()` everywhere, as a `private readonly` (or
`protected readonly` when template-visible) field, no constructors used
purely for DI — the current Angular style-guide recommendation, and already
the majority pattern in `shared/`.

## P0 — Component inputs: legacy `@Input()` vs signal `input()` ✅ Resolved

`icon.component.ts` was the only component still using the decorator form
(`@Input() name!: string; @Input() size: number = 18;`) while everywhere
else (`button.directive.ts`, `loader.component.ts`) used the signal input
API. Converted to:

```ts
readonly name = input.required<string>();
readonly size = input(18);
```

This also removes the non-null assertion (`name!`), a code smell in its own
right — nothing enforced that callers actually passed `name`.

## P1 — Imperative state + `ChangeDetectorRef` vs signals ✅ Resolved

CLAUDE.md describes this app's frontend as "signal-based" — true for the
services, but the three route components (`RecipeListComponent`,
`RecipeDetailComponent`, `RecipeFormComponent`) instead used plain mutable
fields (`recipes: Recipe[] = []`, `loading = true`), manual
`.subscribe({ next, error })`, and `ChangeDetectorRef.markForCheck()` in
every callback to make `OnPush` pick up the mutation — the biggest
structural inconsistency in the codebase relative to its own stated
architecture, and the source of several smaller bugs (missed unsubscribes,
duplicated delete-confirm flow).

**Convention/Resolution:** model per-component request state as signals
(`protected readonly recipes = signal<Recipe[]>([])`, etc., or `toSignal()`
over the service Observable / `resource()` for the loads), with
`.set()`/`.update()` in subscribe callbacks instead of mutating fields +
calling `markForCheck()`. All three route components now do this
(`recipes`/`loading`/`error`/`deleting` etc.), and `ChangeDetectorRef` has
been removed from all three files.

## P1 — Explicit `standalone: true` is inconsistent ✅ Resolved

Present on some components (`app.component.ts`, `recipe-form.component.ts`,
`confirm-dialog.component.ts`, etc.), absent on others
(`recipe-list.component.ts`, `nav-bar.component.ts`). Standalone is the
default in current Angular (the flag is a no-op either way), so this wasn't
a functional bug, but the inconsistency read as accidental.

**Resolution:** dropped the flag everywhere rather than adding it
everywhere — it's dead weight once every component is implicitly
standalone.

## P1 — Duplicated delete-confirm flow ✅ Resolved

`deleteRecipe()` in `recipe-list.component.ts` and
`recipe-detail.component.ts` were near-identical: build the same
`ConfirmOptions` shape, subscribe, branch on `confirmed`, call
`recipeService.delete()`, handle success/error.

**Resolution:** extracted into `RecipeService.deleteWithConfirm(recipe, onConfirmed?)`,
which owns the confirm-dialog wiring and delete call and returns
`Observable<boolean>` (`false` on cancel, `true` after a successful delete).
Both components now just handle their own success/error side effect (filter
the list vs. navigate away) and no longer inject `ConfirmDialogService`.

## P1 — No subscription cleanup ✅ Resolved

None of `ngOnInit`'s `.subscribe(...)` calls in the three route components
were torn down — a slow response could resolve after a lazily-swapped
route's component was destroyed and call `.markForCheck()` (or a signal
`.set()`) on an orphaned instance. Not causing visible bugs since Angular
tolerates this, but the kind of thing that turns into a real leak as
requests grow slower or more numerous.

**Convention/Resolution:** `takeUntilDestroyed()` on every subscription in a
component (services can stay as-is since they're `providedIn: 'root'` and
live for the app's lifetime) — or migrate reads to `toSignal()`/`resource()`,
preferred where feasible since it removes the need for manual teardown
entirely. Every `.subscribe()` in the three route components is now piped
through `takeUntilDestroyed()` (explicit `DestroyRef` field where the
subscription isn't started from an injection context, e.g. inside a click
handler).

## P2 — Untyped reactive forms ✅ Resolved

`RecipeFormComponent.form` was a bare `FormGroup`, so `this.form.value` and
`.patchValue(...)` were untyped — a typo in a control name (`titel` vs
`title`) would be a silent runtime no-op, not a compile error.

**Resolution:** `form` is now typed as
`FormGroup<{ title: FormControl<string>; description: FormControl<string>; content: FormControl<string> }>`,
built via `fb.nonNullable.group(...)`; submission reads `form.getRawValue()`
instead of the untyped `.value`.

## P2 — Mixed external vs inline template/styles ✅ Rule documented

Most components use `templateUrl`/`styleUrl` pointing at sibling `.html`/
`.scss` files. `confirm-dialog.component.ts` and `loader.component.ts`
inline both directly in the `.ts` file instead — reasonable for genuinely
tiny components, but there was no stated threshold, so it read as
arbitrary.

**Resolution:** documented a rule in `CLAUDE.md` under "Frontend coding
style" — inline only when template + styles together are under ~20 lines
(roughly `loader`/`confirm-dialog`'s size); anything larger goes external.
Existing choices already matched the rule, so nothing moved.

## P2 — Public vs `protected` component members ✅ Resolved

`nav-bar.component.ts` and `confirm-dialog.component.ts` marked
template-only members `protected readonly`; `recipe-list`, `recipe-detail`,
and `recipe-form` left all their fields (`recipes`, `loading`, `error`,
`deleting`, `form`, `recipe`, ...) implicitly `public`, even though none
were meant to be called from outside the component.

**Convention/Resolution:** `protected` for anything referenced only from the
component's own template, `private` for anything not referenced from the
template at all — reserve `public` for members genuinely meant to be part
of the component's external API (rare for a routed page component). Applied
across `recipe-list`/`recipe-detail`/`recipe-form` (e.g. `loadRecipes()` in
`RecipeListComponent` is now `private` since nothing in its template calls
it).

## P2 — Test coverage (partially addressed, still tracked)

Only one spec file existed in the whole app (`recipe.service.spec.ts`) — no
tests for any component, directive, pipe, or the HTTP interceptor. Worth
tracking since the P1 signal refactor was a natural point to add component
tests against the new signal state instead of
`ChangeDetectorRef.markForCheck()` call counts.

**Status:** `recipe.service.spec.ts` gained coverage for the new
`deleteWithConfirm()` method, but component-level specs for
`RecipeListComponent`/`RecipeDetailComponent`/`RecipeFormComponent`, the
HTTP interceptor, `ButtonDirective`, and `IconComponent` still don't exist —
left as a deliberate, low-urgency follow-up rather than bundled into this
pass.
