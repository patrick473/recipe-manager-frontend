# Image Support Implementation — Summary & Lessons Learned

Notes from implementing `IMAGE_SUPPORT_SPEC.md` (2026-07-26), done via
orchestrated subagents across both repos.

## Summary

**Task:** Disk-backed hero-image storage and three multipart/binary
endpoints (Part 1), OpenAPI + regenerated Orval client (Part 2), and
frontend display/upload across list, detail, and form (Part 3).

**Approach:** Part 1 → 2 → 3 ran strictly sequentially (a hard technical
dependency — no typed client exists before codegen runs). Within Part 3,
the spec's "list/detail first, form last" sequencing was risk-based, not a
technical dependency, so after doing the one shared prerequisite by hand
(`resolveImageUrl()` util + `RecipeService.uploadImage()`/`deleteImage()` —
small enough that delegating it risked two agents inventing different
versions), the remaining two pieces were fanned out to parallel subagents:
one scoped to `RecipeListComponent`/`RecipeDetailComponent`, one to
`RecipeFormComponent`, each explicitly told not to touch the other's files.
Backend Part 1 ran as a foreground subagent; `openapi.yaml` + codegen was
done directly (mechanical). Every stage's self-reported "all green" was
independently re-verified (`mvn test`, `tsc`, `npm test`, `npm run lint`)
rather than trusted.

**Result:** Backend 67/67 tests, frontend 129/129 tests, clean
typecheck/lint/prettier.

**Notable catches:**

- This JDK's `ImageIO` has no registered WebP reader — a literal
  `ImageIO.read()` sniff would have silently rejected every genuine WebP
  upload. Worked around with a RIFF/WEBP container-signature check for that
  one format, which can't decode pixels but still defeats a spoofed
  content-type.
- Tomcat's default `max-swallow-size` (2MB) is smaller than the gap between
  an oversized upload and the 5MB limit, producing a raw connection reset
  instead of a clean 400. Raised to 10MB in `application.properties` — a
  real production concern, not just a test artifact.
- Spring Boot 4.1.0's Maven POM for `spring-boot-resttestclient` is missing
  a transitive dependency only present in its Gradle module metadata,
  causing `TestRestTemplate` to fail with `NoClassDefFoundError` until
  `spring-boot-restclient` was added explicitly as a test dependency.
- Reading the actual frontend diff (not just test results) surfaced a real
  gap the parallel file-scoped split created: the form's create-mode
  partial-failure path navigated with `router state: {imageUploadFailed:
true}`, but nothing consumed it, since the detail-page agent was
  scoped away from the form. The spec's required user-facing message would
  silently never have appeared. Fixed by adding the consumer (a signal
  seeded from `history.state` + a notification banner) to
  `RecipeDetailComponent` directly.

## Lessons Learned

- A spec's sequencing section can describe two different kinds of
  ordering — a hard technical dependency (Part 1→2→3, can't parallelize)
  versus risk-management ordering (list/detail before form, safe to
  parallelize once the one real shared prerequisite is factored out).
  Reading _why_ a spec sequences something, not just _that_ it does, is
  what determines whether subagents can fan out.
- Splitting frontend work across parallel agents by file scope is safe for
  each agent's own files but can hide a gap at the seam between them — a
  cross-component contract (shared router state, an event, a signal one
  component writes and another reads) needs an explicit check before
  considering a file-scoped split done; neither scoped-down agent can be
  expected to notice it alone.
- Independent verification keeps paying off, but a clean test run alone
  didn't catch the router-state gap above — no test spanned both
  components. Reading the diff itself, not just its test outcome, is what
  mattered here.
- Backend library/runtime quirks (missing JDK codecs, container defaults,
  Maven/Gradle POM gaps) are version-specific and only findable
  empirically — treat "the spec's approach should compile and pass as
  written" as a hypothesis to verify against the actual toolchain.
