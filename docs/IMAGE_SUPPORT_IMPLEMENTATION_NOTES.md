# Image Support Implementation — Summary & Lessons Learned

Notes from implementing `IMAGE_SUPPORT_SPEC.md` (2026-07-26), done via
orchestrated subagents across both repos. Kept alongside the spec for future
reference on _how_ the work happened, not just what changed.

## Summary

**Task:** Add a single hero image per recipe: disk-backed storage and three
new multipart/binary endpoints on the backend (Part 1), an OpenAPI contract
update plus regenerated Orval client (Part 2), and frontend display/upload
across the list, detail, and form components (Part 3).

**Approach:** The spec stated Part 1 → Part 2 → Part 3 as a hard sequential
chain (Part 2 needs Part 1's response shape to exist; Part 3 needs a typed
client that doesn't exist until Part 2 runs), so those three stages ran
strictly in order, each verified independently before the next began — same
pattern as the server-side pagination work
([[project_server_side_pagination_spec_implemented]]). Within Part 3,
though, the spec's own "suggested sequencing" (list/detail first, form last)
was explicitly risk-based ("lowest risk... most fiddly piece"), not a
technical dependency — list/detail and the form touch disjoint files and
neither's correctness depends on the other's output. So after doing the one
genuinely shared prerequisite by hand (the `resolveImageUrl()` util and
`RecipeService.uploadImage()`/`deleteImage()` — small enough that delegating
it risked two agents each inventing a slightly different version), Part 3's
remaining two pieces were fanned out to run in parallel:

1. **`spring-boot-engineer` subagent** (foreground) — Part 1: `imageFilename`
   on `Recipe`, `ImageStorageService`/`LocalDiskImageStorageService`,
   `POST`/`DELETE`/`GET /recipes/{id}/image`, `ImageIO`-based content
   sniffing, new exceptions wired into `GlobalExceptionHandler`, plus test
   coverage (`LocalDiskImageStorageServiceTest`, `RecipeServiceImageTest`,
   `RecipeControllerImageTest`).
2. **Independent verification** — re-ran `mvn test` myself rather than
   trusting the agent's self-reported "67 tests pass, BUILD SUCCESS."
3. **`openapi.yaml` + `npm run api:generate`** done directly (mechanical,
   no judgment calls), then confirmed by hand that the generated
   `uploadRecipeImage(id, { file })` builds `FormData` internally rather than
   expecting the caller to — the exact risk the spec flagged as worth
   checking before writing code against it.
4. **Two `angular-architect` subagents in parallel** (background) — one
   scoped to `RecipeListComponent`/`RecipeDetailComponent` (thumbnails, hero
   image, placeholder), one scoped to `RecipeFormComponent` (file input,
   preview, remove button, client-side validation, the create-then-upload /
   update-then-delete submit chain). Each was explicitly told not to touch
   the other's files.
5. **Independent verification, plus a diff read that caught a real gap** —
   re-ran `tsc`, the full `npm test`, and `npm run lint` myself rather than
   stopping at either agent's "all green" self-report. Reading the actual
   `recipe-form.component.ts` diff (not just its test results) surfaced that
   the create-mode partial-failure path navigated to the detail page with
   `router state: { imageUploadFailed: true }` — but nothing read that state,
   since the form agent was deliberately scoped away from
   `RecipeDetailComponent`. The spec's required user-facing message
   ("Recipe created, but the image failed to upload...") would silently
   never have appeared. Fixed by adding the consumer (a signal seeded from
   `history.state`, plus a notification banner) to `RecipeDetailComponent`
   directly, with two new tests.

**Result:** Backend 67/67 tests passing, `BUILD SUCCESS`. Frontend 129/129
tests passing, typecheck clean (`tsconfig.app.json` and `tsconfig.spec.json`),
lint clean, prettier clean.

**Notable catches, backend (all found empirically by the subagent, not
assumed from the spec):**

- This JDK's `ImageIO` has no registered WebP reader at all
  (`ImageIO.getReaderFormatNames()` — only jpeg/png/gif/bmp/tiff/wbmp). A
  literal `ImageIO.read()` sniff, as the spec described, would have silently
  rejected every genuine WebP upload. Worked around by falling back to a
  RIFF/WEBP container-signature check for that one format — it can't fully
  decode pixels, but still defeats a spoofed-Content-Type upload, which is
  the actual threat model this spec cared about.
- Tomcat's default `max-swallow-size` (2MB) is smaller than the gap between a
  too-large upload and the 5MB limit, so an oversized request got a raw
  connection reset instead of a clean 400 `ProblemDetail` — raised to 10MB in
  `application.properties`. This affects real oversized uploads in
  production too, not just the test that caught it.
- Spring Boot 4.1.0's Maven POM for `spring-boot-resttestclient` is missing a
  transitive dependency present only in its Gradle module metadata, causing
  `TestRestTemplate` to fail with `NoClassDefFoundError` until
  `spring-boot-restclient` was added explicitly as a test dependency.

## Lessons Learned

**A spec's sequencing section can describe two different kinds of ordering,
and they call for different orchestration.** Part 1→2→3 was a hard technical
dependency (typed client can't exist before codegen runs), so it stayed
strictly sequential. But _within_ Part 3, "list/detail first, then the
form" was sequencing for risk-management reasons the spec said outright
("lowest risk, immediately visible payoff" vs. "the most fiddly piece") —
not because the form's correctness depends on list/detail's output. Once the
one real shared prerequisite (the util + service methods) was factored out
and done first, the remaining two pieces were safe to parallelize because
they touch disjoint files. Reading _why_ a spec sequences something, not
just _that_ it does, is what determines whether subagents can fan out.

**Splitting work across parallel agents by file scope is safe for each
agent's own files, but can hide a gap at the seam between them.** Both Part
3 agents finished with "all green" — accurate for what each one owned. But
the create-mode failure path is inherently cross-component (the form decides
something failed; only the detail page, which the form navigates to, can
display it), and the artificial file-scope boundary meant neither agent had
visibility into the other's half of that handshake. Neither agent's
self-report could have caught this — it only surfaced by reading the actual
diff end-to-end and asking "does this router state get consumed anywhere,"
not by re-running either agent's own tests. When splitting a spec's frontend
work across components by file ownership, explicitly check for any
cross-component contract (shared router state, an event, a signal one
component reads that another writes) before considering the split done —
that seam is the orchestrator's responsibility, not something either
scoped-down agent can be expected to notice on its own.

**Independent verification keeps paying off, including catching things a
clean test run doesn't.** Per existing guidance
([[feedback_verify_tests_after_subagent_chain]]), `mvn test` and the full
frontend `tsc`/`test`/`lint` suite were re-run directly rather than trusting
either subagent's self-reported pass/fail. This time, re-running tests alone
would _not_ have caught the router-state gap above — no test asserted that
behavior because no test file spanned both components. The additional
step that mattered here was reading the diff itself, not just its test
outcome.

**Backend library/runtime quirks keep surfacing per-task and are only
findable empirically.** As with the Spring Data `Specification.and()`
null-intolerance found during pagination work, this task hit three more
version-specific surprises (no JDK WebP decoder, Tomcat's swallow-size
default, a Maven-vs-Gradle POM gap in Spring Boot 4.1's test starter) that a
spec written against general framework behavior couldn't have predicted.
Worth continuing to treat "the spec's described approach should compile and
pass as written" as a hypothesis to verify against the actual toolchain, not
a given.
