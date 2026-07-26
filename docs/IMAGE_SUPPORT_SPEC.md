# Image Support

Design spec for [FUTURE_IDEAS.md](FUTURE_IDEAS.md) item 7: "add an `imageUrl`
(or upload) field to `Recipe`/DTOs, show a thumbnail in the list and hero
image on detail." This spec picks **upload**, not a hand-typed URL field —
recipes here are user-authored content with no external image hosting
already in the picture, so a URL field would just push the "where do I host
an image" problem onto the user. One image per recipe (a hero image), no
gallery — matches the "hero image" wording in the backlog entry.

**Explicitly out of scope for this pass:** multiple images per recipe,
client-side cropping/resizing UI (the browser just sends the file as
selected), image editing, and cloud object storage (S3/GCS). Images are
stored on local disk, mirroring how this repo already runs H2 in dev and
defers Postgres/prod config (`FUTURE_IDEAS.md` item 15) — swapping the
storage backend later is a config change behind a small interface, not a
rewrite; see "Deferred" at the end.

---

## Current state (baseline)

- `Recipe` ([Recipe.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/model/Recipe.java)) has no image-related field. `RecipeRequest`/`RecipeResponse` mirror it 1:1 otherwise.
- `RecipeController`'s five endpoints are all `application/json` in and out ([RecipeController.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/controller/RecipeController.java)) — no multipart handling exists anywhere in the backend today.
- The backend has no static/uploaded-file serving configured and no file-storage dependency in [pom.xml](../../recipe-manager-backend/pom.xml).
- Frontend and backend run on different origins in dev (`:4200` vs `:8080`). The only place that bridges this today is [api-base-url.interceptor.ts](../src/app/interceptors/api-base-url.interceptor.ts), which prepends `environment.apiUrl` to relative **HttpClient** request URLs. It does **not** touch template-bound `<img src>` attributes — those are plain DOM attributes the browser resolves against its own origin, so a relative image path in a template would silently 404 against `:4200` instead of `:8080`. This spec needs a second, deliberate mechanism for that case (Part 3).
- `RecipeListComponent` renders cards (grid) and rows (list) with no image slot ([recipe-list.component.html](../src/app/components/recipe-list/recipe-list.component.html)); `RecipeDetailComponent` renders title/description/content with no hero slot ([recipe-detail.component.html](../src/app/components/recipe-detail/recipe-detail.component.html)); `RecipeFormComponent` has no file input ([recipe-form.component.ts](../src/app/components/recipe-form/recipe-form.component.ts)).
- `RecipeRequest`/`RecipeResponse`/create/update are pure JSON round-trips end to end — `RecipeFormComponent.onSubmit()` builds one JSON object and POSTs/PUTs it in a single call.

---

## Part 1 — Backend: storage, entity, and endpoints

### Behavior

- A recipe has at most one image. Uploading a new one replaces the old one (old file deleted from disk).
- Three new endpoints, all operating on an **existing** recipe (a fresh `POST /recipes` never carries image bytes — see the create-flow note below):
  - `POST /recipes/{id}/image` — `multipart/form-data`, single part named `file`. Validates, stores, updates the recipe, returns the updated `RecipeResponse` (200).
  - `DELETE /recipes/{id}/image` — removes the stored file and clears the recipe's image reference. Returns the updated `RecipeResponse` (200); a no-op-but-still-200 if the recipe had no image (idempotent, same spirit as the rest of this API).
  - `GET /recipes/{id}/image` — streams the raw image bytes with the correct `Content-Type`, `Cache-Control: max-age=31536000, immutable` (filenames are content-addressed, see below, so a cache-bust on replace is automatic) and `ETag`. 404 (`ProblemDetail`) if the recipe doesn't exist or has no image.
- Validation on upload, in order, each failure a 400 `ProblemDetail` (same shape `GlobalExceptionHandler` already produces):
  1. Size: rejected above `spring.servlet.multipart.max-file-size` (set to `5MB`, alongside `max-request-size=5MB`).
  2. Declared content type must be one of `image/jpeg`, `image/png`, `image/webp` — checked against the multipart part's `Content-Type` header first as a cheap reject.
  3. **Content sniffing**, not just trusting the header: `ImageIO.read(inputStream)` must return a non-null `BufferedImage`. A client can lie about `Content-Type`; decoding the bytes is a low-effort guard against someone uploading an arbitrary file renamed to `.jpg`. This isn't malware scanning — it only proves "this decodes as a raster image" — which is enough for this app's threat model (no other users see another user's uploads rendered anywhere but `<img>`).
- `RecipeRequest` (create/update JSON body) is **unchanged** — image upload stays a separate call, never bundled into the JSON payload.
- `RecipeResponse` gains `imageUrl: String` (nullable) — a **relative** path, `/recipes/{id}/image`, set only when the recipe has an image; `null` otherwise. Relative and API-shaped (not a raw static-file path) so it flows through the exact same origin-resolution story as every other endpoint, and so a future swap to S3 (Part "Deferred") changes only what this endpoint does internally, not the contract.

### Implementation

- New `app.storage.upload-dir` property (`application.properties`), default `uploads` (relative to the working directory the backend is started from). Not committed — add `recipe-manager-backend/uploads/` to `.gitignore` alongside the existing `target/` entry.
- New `service/ImageStorageService` — a small interface (`store(Long recipeId, MultipartFile file): String filename`, `delete(String filename): void`, `load(String filename): Resource`) with one implementation, `LocalDiskImageStorageService`, backed by `app.storage.upload-dir`. The interface split is deliberate but minimal — it's what makes "swap to S3 later" a new `@Service` + a Spring profile rather than a rewrite of `RecipeService`/`RecipeController`, without building any actual S3 support now.
- Filenames are `{UUID}.{ext}` (extension derived from the sniffed image format, e.g. `ImageIO`'s detected format name) — never the client-supplied filename, which sidesteps path-traversal and collision concerns entirely rather than trying to sanitize an untrusted filename.
- `Recipe` entity: add `private String imageFilename;` (nullable `@Column`) — stores only the generated filename (e.g. `3f2a91e0-....jpg`), not a full path; `LocalDiskImageStorageService` owns turning that into `Path.of(uploadDir, filename)`.
- `RecipeService` gains:
  - `uploadImage(Long id, MultipartFile file): RecipeResponse` — loads the recipe (404 via existing `RecipeNotFoundException` if missing), validates content-type + `ImageIO` decode (throwing a new `InvalidImageException` → 400 on failure), deletes the old file via `ImageStorageService.delete()` if `imageFilename` was already set, stores the new file, sets `imageFilename`, saves, returns `toResponse()`.
  - `deleteImage(Long id): RecipeResponse` — 404 if the recipe doesn't exist; if `imageFilename` is set, deletes the file and clears the field; saves either way and returns `toResponse()`.
  - `loadImage(Long id): Resource` (plus the recipe's `imageFilename`/content type for the controller to set headers) — 404 (new `ImageNotFoundException`) if the recipe doesn't exist or has no image.
  - `toResponse()` gains `.imageUrl(entity.getImageFilename() != null ? "/recipes/" + entity.getId() + "/image" : null)`.
- New exceptions, following the existing `RecipeNotFoundException`/`InvalidSortFieldException` pattern (`@ResponseStatus` + a `GlobalExceptionHandler` entry for the `ProblemDetail` `type`/`title`): `InvalidImageException` (400), `ImageNotFoundException` (404).
- `RecipeController` gains the three endpoints under the existing `@RequestMapping("/recipes")`, delegating straight to the three new service methods; `GET /recipes/{id}/image` returns `ResponseEntity<Resource>` (not a plain DTO, since this one endpoint serves bytes, not JSON) with `Content-Type`/`Cache-Control`/`ETag` set from what `RecipeService.loadImage()` returns.
- `pom.xml`: no new dependency needed — `ImageIO` is JDK-standard and `spring-boot-starter-web` already provides `MultipartFile`/`Resource`.

### Files touched

- [Recipe.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/model/Recipe.java): add `imageFilename`.
- [RecipeResponse.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/dto/RecipeResponse.java): add `imageUrl`.
- [RecipeService.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/service/RecipeService.java): `uploadImage()`, `deleteImage()`, `loadImage()`, `toResponse()` update.
- [RecipeController.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/controller/RecipeController.java): three new endpoints.
- New `service/ImageStorageService.java` (interface) + `service/LocalDiskImageStorageService.java`.
- New `exception/InvalidImageException.java`, `exception/ImageNotFoundException.java`; [GlobalExceptionHandler.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/exception/GlobalExceptionHandler.java) gains two handlers.
- [application.properties](../../recipe-manager-backend/src/main/resources/application.properties): `app.storage.upload-dir`, `spring.servlet.multipart.max-file-size`/`max-request-size`.
- [.gitignore](../../recipe-manager-backend/.gitignore): add `uploads/`.
- New test files: `LocalDiskImageStorageServiceTest` (store/delete/load against a `@TempDir`), `RecipeServiceImageTest` (upload replaces old file, delete clears field, 404s), `RecipeControllerImageTest` (`@WebMvcTest` or full `MockMvc` multipart upload, oversized rejected, wrong content-type rejected, non-image bytes with a spoofed `image/jpeg` header rejected).

---

## Part 2 — OpenAPI contract & client regeneration

### Behavior

- `openapi.yaml` gains three new paths under the existing `Recipes` tag: `POST /recipes/{id}/image` (`requestBody.content.multipart/form-data.schema` = `{ type: object, properties: { file: { type: string, format: binary } } }`), `DELETE /recipes/{id}/image`, `GET /recipes/{id}/image` (response `content.image/*` — `image/jpeg`, `image/png`, `image/webp` — schema `{ type: string, format: binary }`).
- `RecipeResponse` schema gains `imageUrl: { type: string, nullable: true }`.
- New `400`/`404` responses on the image endpoints reuse the existing `ProblemDetail` schema already defined for the other endpoints.

### Implementation

- Edit `openapi.yaml` first, then run `npm run api:generate` per `CLAUDE.md`'s cross-repo contract rule.
- **Risk to verify early, before building on top of it:** Orval's handling of `multipart/form-data` request bodies varies by version/config — confirm what `RecipesService.uploadRecipeImage()` actually generates (ideally a method taking a `File`/`Blob` and building a `FormData` internally). If the generated signature is awkward (e.g. expects a raw `FormData` the caller has to build by hand, or doesn't set the right header), it's fine for `RecipeService.uploadImage()` (Part 3) to build the `FormData` itself and call the generated method with it — don't fight the generator, just don't assume its ergonomics without checking the actual generated file first.
- `src/app/models/recipe.model.ts`: `imageUrl` flows through automatically via the existing `export type Recipe = RecipeResponse` re-export — no edit needed there.

### Files touched

- [openapi.yaml](../../recipe-manager-backend/openapi.yaml)
- `src/app/api/generated/**` (regenerated, not hand-edited)

---

## Part 3 — Frontend: display, upload, and the cross-origin image-URL problem

### Behavior

- **Resolving `imageUrl` to a loadable `<img src>`:** since the interceptor doesn't touch template bindings (see baseline), add one small pure function, `resolveImageUrl(path: string | null | undefined): string | null` in `shared/image-url.util.ts` — `environment.apiUrl + path` when `path` is set, `null` otherwise — mirroring the existing `totalTimeMinutes` shared-util pattern ([recipe-time.util.ts](../src/app/shared/recipe-time.util.ts)). This is a second, deliberate place the environment host gets applied, alongside the interceptor; worth a one-line comment on the function explaining why it exists rather than just using the interceptor, since CLAUDE.md calls the interceptor out as "the only place" — that claim is about HttpClient requests specifically, and this doesn't contradict it so much as complete it for the one case HttpClient isn't involved (a browser-native `<img>` fetch).
- **List page** (`RecipeListComponent`): a thumbnail in both view modes — grid cards get a fixed-aspect-ratio image at the top of the card (above the title), list rows get a small square thumbnail to the left of the title/description block. Recipes with no image show a placeholder (a muted box with `app-icon name="image"`), not a broken-image icon or blank space — same "don't leave an ambiguous gap" instinct as the existing "No description" muted-text fallback.
- **Detail page** (`RecipeDetailComponent`): a full-width hero image above the title, `object-fit: cover` at a fixed max-height (matches the "hero image" framing in the backlog item). No image → no hero slot at all (unlike the list thumbnail, there's no placeholder box here; the title just sits at the top like it does today), since a large empty/placeholder block reads as more visually broken on a detail page than a small muted thumbnail does in a list.
- **Form** (`RecipeFormComponent`) — this is where the "image upload needs an existing recipe id, but the create flow is a single JSON POST" tension from Part 1 actually surfaces, and it's resolved as follows:
  - A file input + live preview (`URL.createObjectURL` on selection, revoked on change/destroy) + "Remove image" button, in both create and edit mode — the control is never disabled/hidden, so the user doesn't need to understand the two-request choreography happening underneath.
  - **Edit mode:** an existing image (if any) preloads into the preview via `resolveImageUrl()`. On submit: the JSON PUT fires first as it does today; if the user selected a new file, an image POST follows; if the user clicked "Remove" (and didn't select a replacement), an image DELETE follows instead. Only one of upload/delete ever fires per submit.
  - **Create mode:** on submit, the JSON POST fires first as today, returning the new recipe's id; if the user had selected a file, an image POST for that new id follows immediately, and the router navigation to `/recipes/:id` waits for that second call to settle. If the image upload fails after the recipe itself was already created, the recipe still exists — surface a distinct, non-blocking message ("Recipe created, but the image failed to upload — try again from the edit page") rather than treating the whole submit as failed, since retrying the "create" half would produce a duplicate recipe.
  - Client-side pre-checks mirroring the backend's validation (file type from `file.type`, size from `file.size`) fire on file selection, before any network call — same "fail fast, fail locally" instinct as the existing required-field validators, and it saves a round trip for the common mistake (picking a screenshot that's actually a `.heic` or an oversized photo straight off a phone). The backend re-validates regardless (never trust client-side checks alone).

### Implementation

- `RecipeService` gains `uploadImage(id: number, file: File): Observable<Recipe>` and `deleteImage(id: number): Observable<Recipe>`, thin wrappers around the generated client methods (see Part 2's risk note on what exactly those look like).
- `RecipeFormComponent`: add `selectedFile = signal<File | null>(null)`, `imagePreviewUrl = signal<string | null>(null)` (seeded from `resolveImageUrl(recipe()?.imageUrl)` in edit mode, replaced with an object URL on file selection), `imageRemoved = signal(false)`, `imageError = signal<string | null>(null)`. `onFileSelected(event)` runs the client-side type/size checks, sets `imageError` and bails on failure, otherwise sets `selectedFile`/`imagePreviewUrl`/clears `imageRemoved`. `onRemoveImage()` clears `selectedFile`/`imagePreviewUrl` and sets `imageRemoved(true)`. `onSubmit()`'s existing `save$` chain (per [recipe-form.component.ts:166-169](../src/app/components/recipe-form/recipe-form.component.ts)) gets a `switchMap`/`concatMap` continuation: after `save$` resolves, if `selectedFile()` is set call `uploadImage`, else if `imageRemoved()` is set (edit mode only) call `deleteImage`, else pass through; only _then_ navigate — with the create-mode partial-failure handling described above wrapping just that second call.
- `RecipeListComponent`/`RecipeDetailComponent`: read `resolveImageUrl(recipe.imageUrl)` in the template, bind to `[src]` with the placeholder `@if`/`@else` (list) or `@if` (detail) described above.
- CSS: `.recipe-card-thumb`/`.recipe-list-row-thumb`/`.recipe-detail-hero` — fixed aspect ratio (e.g. `aspect-ratio: 4/3` for cards/rows, `16/9` capped at a max-height for the hero), `object-fit: cover`, matching the existing card/row/detail styling in each component's `.scss`.

### Files touched

- New `shared/image-url.util.ts` (+ `.spec.ts`).
- [recipe.service.ts](../src/app/services/recipe.service.ts) / [recipe.service.spec.ts](../src/app/services/recipe.service.spec.ts): `uploadImage()`/`deleteImage()`.
- [recipe-form.component.ts](../src/app/components/recipe-form/recipe-form.component.ts) / `.html` / `.spec.ts`: file input, preview, submit-chain changes.
- [recipe-list.component.html](../src/app/components/recipe-list/recipe-list.component.html) / `.scss`: thumbnail markup (grid + list) + placeholder.
- [recipe-detail.component.html](../src/app/components/recipe-detail/recipe-detail.component.html) / `.scss`: hero image markup.

---

## Testing

- **Backend** (see Part 1's "Files touched" for the new test files):
  - `LocalDiskImageStorageService`: store writes a file under the configured dir with a generated name and returns it; delete removes the file (and is a no-op, not an error, if the file is already gone); load returns a `Resource` that resolves to the stored bytes.
  - `RecipeService` image methods: uploading when an image already exists deletes the old file before/after storing the new one (no orphaned files); delete on a recipe with no image is a no-op 200, not a 404; upload/delete/load on a nonexistent recipe id all 404.
  - `RecipeController` (`MockMvc` multipart): valid JPEG/PNG/WebP upload succeeds and `imageUrl` appears in the response; upload above the size limit → 400; non-image bytes served with a spoofed `image/jpeg` header → 400 (proves the `ImageIO` sniff, not just the header check, is doing the rejecting); `GET .../image` on a recipe with an image returns the right `Content-Type` and bytes; on one without, 404.
- **Frontend**:
  - `resolveImageUrl()`: prefixes `environment.apiUrl` for a relative path, returns `null` for `null`/`undefined` input.
  - `RecipeService.uploadImage()`/`deleteImage()`: call the right generated client method with the right args.
  - `RecipeFormComponent`: selecting an oversized/wrong-type file sets `imageError` and does _not_ set `selectedFile` (no network call fires); submit in create mode with a selected file fires create-then-upload in order, navigating only after both settle; submit in edit mode with "Remove image" clicked fires update-then-delete; a failed image upload in create mode still navigates/surfaces the recipe as created (per the partial-failure behavior above) rather than showing a generic submit error.
  - `RecipeListComponent`/`RecipeDetailComponent`: a recipe with `imageUrl` renders an `<img>` with the resolved `src`; a recipe without one renders the placeholder (list) or no hero block at all (detail).

---

## Suggested sequencing

1. **Part 1** (backend storage + entity + endpoints) — land and test independently; nothing in the frontend depends on it existing yet.
2. **Part 2** (OpenAPI + client regen) — immediately after Part 1: update `openapi.yaml`, run `npm run api:generate`, and specifically confirm the generated multipart upload method's shape before writing `RecipeService.uploadImage()` against it (the risk flagged in Part 2).
3. **Part 3** (frontend) — list/detail thumbnails first (pure display, lowest risk, immediately visible payoff), then the form's upload/remove/submit-chain changes last (the most fiddly piece, given the create-mode two-request choreography).

## Deferred

- Swapping `LocalDiskImageStorageService` for an S3-compatible `ImageStorageService` implementation behind a Spring profile, the same way `FUTURE_IDEAS.md` item 15 defers a real `application-prod.properties` for Postgres — this spec's `ImageStorageService` interface is what makes that a follow-up rather than a rewrite.
- Multiple images / a gallery per recipe.
- Server-side resizing/thumbnail generation (today the same full-size file is served everywhere; fine at this app's scale, revisit if upload sizes or traffic make it worth it).
- A dedicated placeholder/default image seeded onto `DataSeeder`'s sample recipes — not required for the feature to work, just a nicer first-run demo experience.
