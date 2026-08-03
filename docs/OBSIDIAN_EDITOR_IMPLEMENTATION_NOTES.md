# Obsidian Editor Implementation — Summary & Lessons Learned

Notes from implementing [OBSIDIAN_EDITOR_SPEC.md](OBSIDIAN_EDITOR_SPEC.md)
(2026-07-26), done via orchestrated subagents rather than a single pass.

## Summary

**Task:** Implement both parts of the spec — a live-preview CodeMirror 6
markdown editor, and a tags/properties metadata panel — across backend and
frontend.

**Approach:** Followed the spec's own suggested sequencing rather than
parallelizing, since each step's output was a hard dependency for the next:
(1) backend fields, foreground and blocking — nothing on the frontend could
start until `mvn test` passed; (2) `npm run api:generate`, done directly as
a single mechanical command; (3) properties panel — one subagent built
`PropertiesPanelComponent` and wired it into both the form and detail
components in the same pass, since splitting them risked inconsistent
design choices between call sites; (4) CodeMirror editor, done last and
isolated per the spec's own call-out that it was the highest-risk, most
novel piece and shouldn't block the properties work — given the most
detailed, concrete guidance of any step (exact Lezer node names, decoration
strategy, CVA wiring) since it had no existing pattern in the codebase to
imitate; (5) manual fix-up and browser verification via a throwaway
Playwright script (no `chromium-cli` available, so adapted the run skill's
Playwright fallback).

**Result:** Both spec parts shipped and browser-verified. Deferred items
(wikilinks, command palette, graph view, vim mode) were out of scope from
the start — see the spec's Deferred section.

## Lessons Learned

- **A subagent's "lint/typecheck/build all pass" is not "nothing broke."**
  The properties-panel agent added a second `recipeService.getAll()` call in
  `RecipeFormComponent.ngOnInit()` (for tag-autocomplete) and verified
  lint/tsc/build green — none of which catch a test file's mock object
  going stale. The next agent (CodeMirror editor) ran the full Vitest suite
  as its own sanity check and caught all 12 `recipe-form.component.spec.ts`
  tests failing, since `fakeRecipeService` had no `getAll`. It had been
  broken for one full agent handoff before anyone ran the actual test
  command. Run the real test suite yourself in the orchestrating turn after
  any handoff touching a covered component — don't rely on each agent's
  self-reported build-only verification.
- **Automated UI tests can manufacture race conditions that don't exist for
  real users.** Verifying the tag-chip adder with back-to-back
  `fill('breakfast'); press(Enter); fill('waffle'); press(Enter)` (no wait
  between) produced only one surviving chip — looked like a dropped-tag
  race in the `output()` → `setValue()` → `input()` round-trip through the
  OnPush parent. Re-running with a 500ms wait after each `press(Enter)`
  produced the correct two-chip result every time; the flaw was the test
  outrunning Angular's change-detection tick, not the component. Re-verify
  with explicit pacing before reporting a UI interaction failure as a real
  defect.
- **Check what's already running before trusting your own diagnosis.** Port
  8080 had a stale, already-erroring backend process (pre-dating this
  session) that would have made correct new code look broken during
  verification. A quick process check before diagnosing "my change broke
  this" avoided chasing a phantom regression.
- **Giving the highest-risk step the most concrete guidance paid off.**
  Unlike the properties panel (which could imitate existing form/detail
  patterns already in the codebase), the CodeMirror editor had zero
  precedent. The prompt included exact Lezer grammar node names, the
  specific decoration strategy (CSS-dim marks rather than
  `Decoration.replace`, to keep text genuinely editable), and explicit
  accessibility guidance (skip `indentWithTab` — it would trap keyboard
  focus). Output matched that guidance closely and made good independent
  calls within it. Vaguer prompts on novel, unprecedented work are where
  subagent output quality drops off fastest.
