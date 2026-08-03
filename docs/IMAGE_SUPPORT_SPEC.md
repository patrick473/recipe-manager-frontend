# Image Support

Spec for [FUTURE_IDEAS.md](FUTURE_IDEAS.md) item 7: an `imageUrl`/upload
field on `Recipe`, thumbnail in the list, hero image on detail.

**Key decision:** upload, not a hand-typed URL field — this app has no
external image hosting story, so a URL field just pushes "where do I host
this" onto the user. One hero image per recipe, no gallery, matching the
backlog's "hero image" wording. Images stored on local disk (mirroring how
this repo already defers Postgres/prod config), behind a small
`ImageStorageService` interface so swapping to S3 later is a new
`@Service` + profile, not a rewrite — see Deferred.

**Explicitly out of scope:** multiple images per recipe, client-side
cropping/resizing, image editing, cloud object storage for now.

**Non-obvious baseline fact:** the existing `api-base-url.interceptor.ts`
only rewrites `HttpClient` request URLs — it never touches template-bound
`<img src>`, which the browser resolves against its own origin. A relative
image path would silently 404 against `:4200` instead of `:8080`, so this
needs a second, deliberate resolution mechanism (see below).

## Shape of the change

- **Backend:** `Recipe` gains `imageFilename` (generated `{UUID}.{ext}`,
  never the client's filename — sidesteps path-traversal/collisions
  entirely). Three endpoints: `POST/DELETE/GET /recipes/{id}/image`
  (multipart in, raw bytes out with `Cache-Control: immutable` + `ETag`,
  since filenames are content-addressed). Upload validation: size limit
  (5MB), declared content-type allowlist, then **content-sniffing** via
  `ImageIO.read()` — a client can lie about `Content-Type`, so decoding the
  bytes is a cheap guard against a renamed arbitrary file (not malware
  scanning, just "does this decode as a raster image"). `RecipeRequest`
  stays JSON-only; image upload is always a separate call. `RecipeResponse`
  gains a relative `imageUrl` (`/recipes/{id}/image` or `null`) so it flows
  through the same origin-resolution story as every other endpoint.
- **Contract:** three new paths + `imageUrl` on `RecipeResponse` in
  `openapi.yaml`, then `npm run api:generate`. Flagged as worth verifying
  early: Orval's multipart-body codegen varies by version — check what the
  generated upload method actually expects (raw `FormData` vs. building it
  internally) before writing frontend code against it.
- **Frontend:** a `resolveImageUrl()` util (`environment.apiUrl + path`) is
  the second deliberate place the API origin gets applied, since the
  interceptor doesn't cover `<img>`. List page gets thumbnails (with a
  muted placeholder box when absent); detail page gets a full-width hero
  (no placeholder when absent — an empty hero block reads as more broken
  than a missing thumbnail does in a list). The form is where "upload needs
  an existing recipe id, but create is a single JSON POST" surfaces: in
  edit mode, JSON PUT fires first, then an image POST or DELETE depending
  on what changed; in create mode, JSON POST fires first, then an image
  POST for the new id — and if that second call fails, the recipe still
  exists, so the UI surfaces a distinct non-blocking message rather than
  treating the whole submit as failed (retrying would create a duplicate).
  Client-side type/size pre-checks fire on file selection to save a round
  trip, but the backend re-validates regardless.

## Testing

Backend: storage service round-trip, upload-replaces-old-file, delete/load
404 semantics, `MockMvc` multipart tests including a spoofed-content-type
rejection (proving the `ImageIO` sniff, not just the header check, does the
rejecting). Frontend: `resolveImageUrl()` unit tests, form tests for
client-side validation gating the network call, create-then-upload /
update-then-delete submit ordering, and the partial-failure UX; list/detail
tests for image-present vs. placeholder rendering.

## Deferred

S3-compatible `ImageStorageService` implementation behind a Spring profile;
multiple images/gallery per recipe; server-side resizing/thumbnails (same
full-size file served everywhere today); a default placeholder image seeded
onto `DataSeeder`'s sample recipes.
