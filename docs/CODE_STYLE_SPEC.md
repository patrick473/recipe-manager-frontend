# Frontend Coding Style Spec

Findings from a review of `recipe-manager-frontend/src` (2026-07-25), and the
changes needed to bring the codebase to one consistent style. No linter or
formatter is currently configured (no `.eslintrc`/`eslint.config.*`, no
`.prettierrc`, no `angular-eslint` or `prettier` in `devDependencies`), which
is the root cause of most of the inconsistencies below — several items are
resolved automatically once tooling is in place; the rest need one-time
manual convergence.

Priority key: **P0** — pick one convention now, before more components copy
the wrong one · **P1** — should fix soon, moderate churn · **P2** — nice to
have, low urgency.

---

## P0 — Tooling gap ✅ Resolved

There is nothing enforcing style today. Every inconsistency in this doc is a
symptom of that.

- [x] Add `@angular-eslint/*` + `eslint` + `typescript-eslint`, with a flat
      `eslint.config.js` (Angular CLI ≥19 scaffolds this via
      `ng add @angular-eslint/schematics`).
- [x] Add `prettier` + `prettier-plugin-organize-imports` (or equivalent),
      with a `.prettierrc` pinning `singleQuote: true`, `printWidth`, and
      Angular HTML formatting.
- [x] Add `npm run lint` / `npm run format` scripts and run both once,
      repo-wide, to eliminate the whitespace/indentation drift called out
      below before doing anything else.
- [ ] Wire lint into CI (or at minimum document it as a pre-PR step) so drift
      doesn't reaccumulate. *(Not done — no CI pipeline exists in this repo
      yet to wire into; `npm run lint`/`npm run format` are available as a
      manual pre-PR step in the meantime.)*

## P0 — Dependency injection: `inject()` vs constructor injection ✅ Resolved

Both styles are in use, sometimes in the same class:

- `inject()` only: [nav-bar.component.ts:14](../src/app/components/nav-bar/nav-bar.component.ts#L14), [confirm-dialog.component.ts:66](../src/app/shared/confirm-dialog/confirm-dialog.component.ts#L66)
- Constructor-only: [recipe-form.component.ts:43-49](../src/app/components/recipe-form/recipe-form.component.ts#L43-L49)
- **Both in the same class**: [recipe-list.component.ts:26](../src/app/components/recipe-list/recipe-list.component.ts#L26) uses `inject(ConfirmDialogService)` as a field but [recipe-list.component.ts:33-36](../src/app/components/recipe-list/recipe-list.component.ts#L33-L36) injects `RecipeService`/`ChangeDetectorRef` via constructor; same split in [recipe-detail.component.ts:30](../src/app/components/recipe-detail/recipe-detail.component.ts#L30) vs [recipe-detail.component.ts:38-44](../src/app/components/recipe-detail/recipe-detail.component.ts#L38-L44).

**Convention to adopt:** `inject()` everywhere, as a `private readonly` (or
`protected readonly` when template-visible) field, no constructors used
purely for DI. This is also the current Angular style-guide recommendation
and is already the majority pattern in `shared/`.

## P0 — Component inputs: legacy `@Input()` vs signal `input()` ✅ Resolved

`icon.component.ts` is the only component still using the decorator form:

```ts
// icon.component.ts:11-12
@Input() name!: string;
@Input() size: number = 18;
```

Everywhere else (`button.directive.ts`, `loader.component.ts`) uses the
signal input API, including a required-string case handled correctly there.
`icon.component.ts` should become:

```ts
readonly name = input.required<string>();
readonly size = input(18);
```

This also removes the non-null assertion (`name!`), which is a code smell in
its own right — nothing enforces that callers actually pass `name`.

## P1 — Imperative state + `ChangeDetectorRef` vs signals ✅ Resolved

CLAUDE.md describes this app's frontend as "signal-based" — true for the
services (`RecipeService`, `ThemeService`, `ConfirmDialogService`), but the
three route components (`RecipeListComponent`, `RecipeDetailComponent`,
`RecipeFormComponent`) don't follow that pattern at all. They use plain
mutable fields (`recipes: Recipe[] = []`, `loading = true`, etc.), manual
`.subscribe({ next, error })`, and `ChangeDetectorRef.markForCheck()` calls
sprinkled through every callback to make `OnPush` pick up the mutation —
e.g. [recipe-list.component.ts:42-58](../src/app/components/recipe-list/recipe-list.component.ts#L42-L58).

This is the biggest structural inconsistency in the codebase relative to its
own stated architecture, and it's also the source of several smaller bugs
below (missed unsubscribes, duplicated delete-confirm flow).

**Convention to adopt:** model per-component request state as signals (or
`toSignal()` over the service Observable / `resource()` for the loads), and
drop `ChangeDetectorRef` entirely. Roughly:

```ts
protected readonly recipes = signal<Recipe[]>([]);
protected readonly loading = signal(true);
protected readonly error = signal<string | null>(null);
```

...with `.set()`/`.update()` in the subscribe callbacks instead of mutating
fields + calling `markForCheck()`. No `ChangeDetectorRef` import should
remain in `recipe-list.component.ts`, `recipe-detail.component.ts`, or
`recipe-form.component.ts` once this lands.

**Resolution:** all three route components now hold signal-based state
(`recipes`/`loading`/`error`/`deleting` etc.) with `.set()`/`.update()` in
subscribe callbacks, and `ChangeDetectorRef` has been removed from all
three files.

## P1 — Explicit `standalone: true` is inconsistent ✅ Resolved

Present: `app.component.ts`, `recipe-form.component.ts`,
`recipe-detail.component.ts`, `confirm-dialog.component.ts`,
`icon.component.ts`, `loader.component.ts`, `button.directive.ts`.
Absent: `recipe-list.component.ts`, `nav-bar.component.ts`.

Standalone is the default in current Angular (the flag is a no-op either
way), so this isn't a functional bug, but the inconsistency reads as
accidental. **Convention to adopt:** drop the flag everywhere rather than
add it everywhere — it's dead weight once every component is implicitly
standalone.

**Resolution:** `standalone: true` removed from every component/directive
that had it.

## P1 — Duplicated delete-confirm flow ✅ Resolved

`deleteRecipe()` in [recipe-list.component.ts:60-87](../src/app/components/recipe-list/recipe-list.component.ts#L60-L87)
and [recipe-detail.component.ts:67-95](../src/app/components/recipe-detail/recipe-detail.component.ts#L67-L95)
are near-identical: build the same `ConfirmOptions` shape, subscribe, branch
on `confirmed`, call `recipeService.delete()`, handle success/error. Worth
extracting into a shared helper (e.g. a small method on `RecipeService` like
`deleteWithConfirm(recipe)` returning an `Observable<boolean>`, or a shared
function in `shared/`) once both call sites are converted to the
signal-based pattern above — otherwise the duplication just gets copied a
third time onto the next component that needs delete-with-confirmation.

**Resolution:** extracted into `RecipeService.deleteWithConfirm(recipe, onConfirmed?)`,
which owns the confirm-dialog wiring and the delete call and returns
`Observable<boolean>` (`false` on cancel, `true` after a successful delete).
Both components now just handle their own success/error side effect
(filter the list vs. navigate away) and no longer inject `ConfirmDialogService`
directly.

## P1 — No subscription cleanup ✅ Resolved

None of `ngOnInit`'s `.subscribe(...)` calls in the three route components
are torn down. Because routes are lazily loaded and swapped, a slow response
can resolve after the component is destroyed and call `.markForCheck()` (or,
post-refactor, a signal `.set()`) on a component instance nobody holds a
reference to anymore. Not currently causing visible bugs since Angular
tolerates this, but it's the kind of thing that turns into a real leak once
requests get slower or more numerous.

**Convention to adopt:** `takeUntilDestroyed()` on every subscription in a
component (services can stay as-is since they're `providedIn: 'root'` and
live for the app's lifetime), or migrate the reads to `toSignal()` /
`resource()`, which manages this automatically. Prefer the latter — it's a
natural pairing with the P1 signals item above and removes the need for
manual teardown entirely.

**Resolution:** every `.subscribe()` in the three route components is now
piped through `takeUntilDestroyed()` (explicit `DestroyRef` field where the
subscription isn't started from an injection context, e.g. inside a click
handler).

## P2 — Untyped reactive forms ✅ Resolved

`RecipeFormComponent.form` is declared as a bare `FormGroup`
([recipe-form.component.ts:35](../src/app/components/recipe-form/recipe-form.component.ts#L35)),
so `this.form.value` and `.patchValue(...)` are untyped — a typo in a
control name (`titel` instead of `title`) would be a silent runtime no-op,
not a compile error. Angular's typed reactive forms
(`FormGroup<{ title: FormControl<string>; ... }>`, or `nonNullable: true`
builders) would catch this at compile time. Lower priority since the form is
small and validation already mirrors the backend, but worth doing before
the form grows more fields.

**Resolution:** `form` is now typed as
`FormGroup<{ title: FormControl<string>; description: FormControl<string>; content: FormControl<string> }>`,
built via `fb.nonNullable.group(...)`; submission reads `form.getRawValue()`
instead of the untyped `.value`.

## P2 — Mixed external vs inline template/styles ✅ Rule documented

Most components use `templateUrl`/`styleUrl` pointing at sibling `.html`/
`.scss` files. `confirm-dialog.component.ts` and `loader.component.ts` inline
both `template`/`styles` directly in the `.ts` file instead. Not wrong by
itself — inlining is reasonable for genuinely tiny components — but there's
no stated threshold, so it reads as arbitrary. **Suggested rule:** inline
only when template + styles together are under ~20 lines (roughly
`loader`/`confirm-dialog`'s current size); anything larger goes external.
Document the rule (e.g. in this file or `CLAUDE.md`) so it's a decision,
not a coin flip.

**Resolution:** the ~20-line threshold above is now documented in
`CLAUDE.md` under "Frontend coding style". No components needed to move
between inline/external as a result — existing choices already matched the
rule.

## P2 — Public vs `protected` component members ✅ Resolved

`nav-bar.component.ts` and `confirm-dialog.component.ts` mark
template-only members `protected readonly`. `recipe-list`,
`recipe-detail`, and `recipe-form` leave all their fields
(`recipes`, `loading`, `error`, `deleting`, `form`, `recipe`, ...) with
implicit `public` access, even though none of them are meant to be called
from outside the component. **Convention to adopt:** `protected` for
anything referenced only from the component's own template, `private` for
anything not referenced from the template at all — reserve `public` for
members genuinely meant to be part of the component's external API (rare
for a routed page component).

**Resolution:** `recipe-list`/`recipe-detail`/`recipe-form` now mark every
template-only member `protected` and every non-template-referenced member
`private` (e.g. `loadRecipes()` in `RecipeListComponent` is `private` since
nothing in its template calls it).

## P2 — Test coverage (partially addressed, still tracked)

Only one spec file exists in the whole app
(`src/app/services/recipe.service.spec.ts`) — no tests for any component,
directive, pipe, or the HTTP interceptor. Not a "style" issue exactly, but
worth tracking alongside this doc since the signal-based refactor above
(P1) is a natural point to add `RecipeListComponent`/`RecipeDetailComponent`
tests against the new signal state instead of against
`ChangeDetectorRef.markForCheck()` call counts.

**Status:** the P1 signal refactor has landed, and `recipe.service.spec.ts`
gained coverage for the new `deleteWithConfirm()` method, but component-level
specs for `RecipeListComponent`/`RecipeDetailComponent`/`RecipeFormComponent`,
the HTTP interceptor, `ButtonDirective`, and `IconComponent` still don't
exist. Left as a deliberate follow-up rather than bundled into this pass —
still P2/low-urgency but now a clean, isolated next step against
signal-based state.

---

## Suggested sequencing

1. Add ESLint + Prettier, run once repo-wide (P0 tooling) — kills the
   whitespace/indentation noise for free and makes the rest of this list a
   clean diff instead of a mixed style+substance diff.
2. Standardize DI (`inject()`) and drop stray `standalone: true` — mechanical,
   low-risk, no behavior change.
3. Fix `icon.component.ts`'s input API — small, isolated.
4. Migrate the three route components to signals + `takeUntilDestroyed()`/
   `toSignal()`, dropping `ChangeDetectorRef` — the one item here with real
   behavioral surface area; do it as its own reviewed change, one component
   at a time.
5. Extract the shared delete-confirm flow once step 4 lands.
6. Typed reactive forms + access-modifier cleanup + inline-vs-external rule
   — pick up opportunistically or as a follow-up pass.
