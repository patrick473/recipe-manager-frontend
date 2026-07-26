# Obsidian Editor Implementation — Summary & Lessons Learned

Notes from implementing `OBSIDIAN_EDITOR_SPEC.md` (2026-07-26), done via
orchestrated subagents rather than a single pass. Kept alongside the spec for
future reference on _how_ this landed, not just what changed.

## Summary

**Task:** Implement both parts of `OBSIDIAN_EDITOR_SPEC.md` — a live-preview
CodeMirror 6 markdown editor, and a tags/properties metadata panel — across
both the backend and frontend repos.

**Approach:** Followed the spec's own suggested sequencing rather than
parallelizing, since each step's output was a hard dependency for the next:

1. **Backend fields, foreground, blocking** — `tags`/`prepTimeMinutes`/
   `cookTimeMinutes`/`servings` added to `openapi.yaml`, the `Recipe` entity,
   `RecipeRequest`/`RecipeResponse`, `RecipeService`, seed data. Nothing on
   the frontend could start until this landed and `mvn test` passed.
2. **`npm run api:generate`**, done directly (not delegated — a single
   mechanical command).
3. **Properties panel** — one subagent built `PropertiesPanelComponent` and
   wired it into both `RecipeFormComponent` (editable) and
   `RecipeDetailComponent` (read-only) in the same pass, since both consume
   the same component and splitting them risked inconsistent design choices
   between the two call sites.
4. **CodeMirror live-preview editor**, done last and isolated, per the spec's
   own explicit call-out that this was "the highest-risk, most novel piece"
   and "shouldn't block the properties work." Given the most detailed,
   concrete implementation guidance of any step (exact Lezer node names,
   decoration strategy, CVA wiring) since this piece had no existing pattern
   in the codebase to imitate.
5. **Manual fix-up and verification**, done directly: a test regression fix,
   then full manual browser verification via a throwaway Playwright script
   (no `chromium-cli` available in this environment, so adapted the run
   skill's Playwright fallback pattern).

**Result:** Both spec parts shipped and browser-verified. Full details of
what's in vs. explicitly deferred are in the spec doc's own "Suggested
sequencing" section — nothing changed there, the deferred items (wikilinks,
command palette, graph view, vim mode) were out of scope from the start.

## Lessons Learned

**A subagent's "lint/typecheck/build all pass" is not the same as "nothing
broke."** The properties-panel agent added a second `recipeService.getAll()`
call inside `RecipeFormComponent.ngOnInit()` (for tag-autocomplete
suggestions) and verified lint/tsc/build — all green, because none of those
catch a test file's mock object silently going stale. The next agent
(CodeMirror editor) ran the full Vitest suite as its own sanity check and
caught that all 12 tests in `recipe-form.component.spec.ts` were failing,
since `fakeRecipeService` had no `getAll`. It had been broken for one entire
agent handoff before anyone ran the actual test command. **Takeaway:** after
any handoff that touches a component covered by an existing spec file, run
the real test suite yourself in the orchestrating turn — don't rely on each
agent's self-reported build-only verification.

**Automated UI tests can manufacture race conditions that don't exist for
real users.** Verifying the tag-chip adder with back-to-back
`fill('breakfast'); press(Enter); fill('waffle'); press(Enter)` (no wait
between) produced only one surviving chip — looked exactly like a dropped-tag
race condition in the `output()` → `setValue()` → `input()` round-trip
through the OnPush parent. Re-running the identical sequence with a 500ms
wait after each `press(Enter)` produced the correct two-chip result every
time. The flaw was the test outrunning Angular's change-detection tick, not
the component. **Takeaway:** before reporting a UI interaction failure as a
real defect, re-verify with explicit pacing between dependent actions; if the
"bug" disappears, it was a test-speed artifact, not a fix target.

**Check what's already running before trusting your own diagnosis.** Port
8080 had a stale, already-erroring backend process (pre-dating this session,
likely the repo's VS Code auto-start task) that would have made correct new
code look broken during verification. A quick `netstat`/process check before
diagnosing "my change broke this" avoided chasing a phantom regression.

**Giving the highest-risk step the most concrete guidance paid off.** Unlike
the properties panel (which could closely imitate existing form/detail
patterns already in the codebase), the CodeMirror editor had zero precedent
in this repo. The prompt for that step included exact Lezer grammar node
names, the specific decoration strategy (CSS-dim marks rather than
`Decoration.replace`, to keep text genuinely editable), and explicit
accessibility guidance (skip `indentWithTab` — it would trap keyboard focus).
The agent's output matched that guidance closely and made good independent
calls within it (e.g. the CSS-only list-marker approximation the spec had
explicitly pre-approved as a fallback). Vaguer prompts on novel,
unprecedented work are where subagent output quality drops off fastest.
