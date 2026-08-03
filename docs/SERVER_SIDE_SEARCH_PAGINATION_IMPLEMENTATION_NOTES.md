# Server-Side Search, Filter & Pagination Implementation — Summary & Lessons Learned

Notes from implementing `SERVER_SIDE_SEARCH_PAGINATION_SPEC.md` (2026-07-26), done via orchestrated subagents across both repos.

## Summary

**Task:** Move `GET /recipes` from "return every row" to a paginated, filterable, sortable endpoint (Part 1), regenerate the typed frontend client from the updated OpenAPI contract (Part 2), and rewire `RecipeListComponent` to be server-driven instead of doing in-memory filter/sort over a fully loaded array (Part 3).

**Approach:** Unlike the Quick Wins work, this spec's three parts are a genuine sequential dependency chain, not just file-overlap — Part 2 needs Part 1's response shape to exist, Part 3 needs a typed client that doesn't exist yet. Ran strictly in sequence, each verified independently before the next began:

1. **`spring-boot-engineer` subagent** (foreground) — Part 1 (`RecipeSpecifications` with the `EXISTS`-subquery tag matching the spec called out as a known JPA pitfall, plus `RecipePageResponse`, nulls-last `Pageable` construction, 400-on-unknown-sort-field) and Part 2's `openapi.yaml` edits together, since the spec itself notes they land in one PR in practice. Wrote the first real test coverage this backend has ever had beyond the smoke test: 34 new tests across `@DataJpaTest`/`@WebMvcTest` slices.
2. Independent verification — re-ran `mvn test` myself rather than trusting the agent's self-report.
3. `npm run api:generate` run directly (mechanical, not delegated) to regenerate the Orval client, then added the `RecipePageResponse` re-export to `recipe.model.ts` by hand.
4. **`angular-architect` subagent** (foreground) — Part 3: deleted the dead `filteredRecipes`/`sortedRecipes` computeds and comparator functions, added debounced search (`toObservable` + `skip(1)` + `debounceTime(300)`), query-param sync via `router.navigate([], { queryParamsHandling: 'merge', replaceUrl: true })`, the accumulating `availableTags` signal, the two-branch empty state, and the pager.
5. Independent verification — re-ran `npm run lint`, `npm run build:prod`, and the full `npm test` myself, reading the actual diffs rather than stopping at the agent's summary.

**Result:** Backend 34/34 tests passing, `BUILD SUCCESS`. Frontend lint clean, prod build succeeds, 109/109 tests passing across 11 files.

## Notable catches

- The frontend agent found `recipe-form.component.ts` also called the old no-arg `RecipeService.getAll()` (for tag-autocomplete suggestions) — a call site not mentioned anywhere in the spec's "Files touched" list. Changing `getAll()`'s signature would have silently broken that component's build. Fixed directly (`getAll({ size: 100 })` reading `response.content`, with a comment noting this is now a best-effort sample of "tags in use" rather than exhaustive) instead of stopping to ask, since the fix was mechanical and clearly in-scope.
- The backend agent hit an undocumented Spring Boot 4.1 change: `@DataJpaTest`/`@WebMvcTest` are no longer transitively pulled in by `spring-boot-starter-test` alone, requiring explicit `spring-boot-starter-data-jpa-test`/`spring-boot-starter-webmvc-test` test dependencies in `pom.xml`.
- Separately, this Spring Data JPA version's `Specification.and()`/`allOf(...)` throw on a `null` element instead of tolerating it (older versions were null-tolerant), so `RecipeService.findAll()` has to filter out `null` specs before combining.

## Lessons Learned

- **A spec's own "sequencing" section is a strong signal for how to orchestrate subagents, not just how to write code.** This spec explicitly described Parts 1→2→3 as sequential with a stated reason (response-shape/type dependency), which translated directly onto subagent orchestration: one agent per part, foreground, verified before the next was dispatched. No attempt to parallelize what the spec itself said was a chain — unlike Quick Wins, where the parts had no such stated dependency and file-overlap analysis was the deciding factor instead.
- **"Files touched" lists in a spec are a floor, not a ceiling — always grep for other call sites of anything whose signature changes.** The spec's Part 3 file list didn't mention `recipe-form.component.ts`. Relying solely on the enumerated list would have shipped a broken build; the agent's own build/lint pass caught it because a signature change is a compile error, not a silent runtime bug — but the general lesson holds even where the mismatch wouldn't be caught automatically.
- **Re-running verification independently (not just reading the agent's self-report) surfaced nothing wrong here, but is still the right default.** Per [[feedback_verify_tests_after_subagent_chain]], both `mvn test` and the frontend lint/build/test trio were re-run directly rather than trusting "34 tests pass"/"109/109 passing" at face value. The reports were accurate this time, but the cost of checking was trivial next to a full compile-and-test cycle.
- **Library/framework version drift showed up mid-task and had to be worked around, not designed for.** Both Spring Boot 4.1 issues above were things a spec written against the general JPA/Spring Data pattern (not this exact dependency graph) couldn't have anticipated — a reminder that a well-researched spec still needs an implementer who checks actual compiler/test errors rather than assuming the described pattern compiles as-is on the exact versions in `pom.xml`.
- **Splitting "implement" from "regenerate the generated client" between a subagent and a direct command was the right call for a mechanical, single-command step.** `npm run api:generate` has no judgment calls in it — delegating it would have added a round-trip for zero benefit, matching the same "not every piece of work needs a subagent" principle from the Quick Wins notes' total-time util.
