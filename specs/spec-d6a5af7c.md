---
id: spec-d6a5af7c
workflow_id: wf-spec-create
run_id: d6a5af7c-f202-4595-b209-d98caed1790b
status: draft
created_at: 2026-09-08T13:29:53.145506128Z
---

# Defines a spec-driven workflow for initializing, documenting, and tracking new feature specifications, applied to the 'ee' feature request.

## Requirements

- Create a new git branch named spec/<NNN-feature-slug> from the default branch.
- Read the spec template at .specify/templates/spec-template.md and the existing specs/_index.md.
- Determine the next free feature number NNN and derive a short feature slug from the request.
- Create specs/NNN-feature-slug/spec.md based on the template, filling in all frontmatter fields and sections.
- Keep the specification scope limited to a single implementation run, splitting larger requests into multiple specs if necessary.
- Update specs/_index.md with an entry for the new feature folder.
- Commit the new and changed files and push the branch to origin to enable pull request creation.
