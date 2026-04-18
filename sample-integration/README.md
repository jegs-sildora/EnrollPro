# Sample Integration Package

This folder contains the artifacts used to expose teammate-ready integration feeds for ATLAS, SMART, and AIMS using deterministic dummy data.

## What this package provides

- Seed script for sample faculty, staff, and enrolled learners.
- Default subsystem endpoints for direct teammate ingestion.
- Public sample endpoints for no-login demo/testing UI.

## Seed workflow

Run from repository root:

```bash
pnpm --filter server run db:seed
pnpm --filter server run db:seed-sample-integration
```

The sample seed creates:

- 10 teacher records
- 10 staff user records (SYSTEM_ADMIN and REGISTRAR)
- 10 enrolled learner records with grade level and section mappings

## Endpoint groups

Protected partner feeds (integration key required):

- /api/integration/v1/default/atlas/faculty
- /api/integration/v1/default/smart/students
- /api/integration/v1/default/aims/context
- /api/integration/v1/staff

Public sample feeds (no key, for non-production testing):

- /api/integration/v1/sample/teachers
- /api/integration/v1/sample/staff
- /api/integration/v1/sample/students

## Notes

- Public sample feeds are intended for development and demos only.
- Keep real learner data out of this package.
- LRN remains the identity key shared across subsystem integrations.
