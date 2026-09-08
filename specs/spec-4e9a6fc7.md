---
id: spec-4e9a6fc7
workflow_id: wf-spec-create
run_id: 4e9a6fc7-3543-4de4-a842-7a8d87a05a80
status: draft
created_at: 2026-09-08T13:20:13.963462763Z
---

# Defines the procedural workflow for initiating, authoring, and version-controlling new feature specifications within a spec-driven development repository.

## Requirements

- Create a new Git branch named spec/<NNN-feature-slug> from the default branch.
- Read the spec template at .specify/templates/spec-template.md and review the existing specs/_index.md.
- Determine the next available feature number (NNN) and derive a short feature slug from the user request.
- Create specs/NNN-feature-slug/spec.md using the template, filling in all frontmatter fields (workflow_id, spec_id, feature_slug, title, created_at, updated_at) and every section.
- Scope the specification to be implementable in a single workflow run, splitting large requests into multiple specs as needed.
- Update specs/_index.md to include an entry for the newly created feature folder.
- Commit all new and modified files and push the branch to origin to facilitate a pull request.
