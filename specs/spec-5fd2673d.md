---
id: spec-5fd2673d
workflow_id: wf-spec-create
run_id: 5fd2673d-cd43-428e-b7a6-a593fdebea57
status: draft
created_at: 2026-09-08T13:12:18.872589417Z
---

# Defines the procedural requirements and file structure for initiating a new feature specification, covering branch creation, template utilization, scoping constraints, index maintenance, and version control operations.

## Requirements

- Create a new git branch named spec/<NNN-feature-slug> from the default branch.
- Read and apply the spec template located at .specify/templates/spec-template.md.
- Read the existing repository specs index at specs/_index.md.
- Determine the next available feature number (NNN) and generate a concise feature slug based on the request.
- Create a new spec file at specs/NNN-feature-slug/spec.md.
- Populate the spec frontmatter with the required fields: workflow_id, spec_id, feature_slug, title, created_at, and updated_at.
- Ensure the spec scope is small enough to be implemented in a single workflow run.
- Split large or complex requests into multiple smaller, independently implementable specs.
- Update specs/_index.md to include an entry for the newly created feature folder.
- Commit all new and modified files to the version control system.
- Push the branch to the origin remote to facilitate pull request creation.
