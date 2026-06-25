# Database Architecture

## Purpose

Explains the Prisma/PostgreSQL model and the main relational boundaries.

## Summary

The database is PostgreSQL managed through Prisma. It models users, teachers, school settings, school years, grade levels, sections, learners, enrollment applications, enrollment records, historical ledgers, audit logs, health records, teacher designations, enrollment listings, PSGC geography, and SF movement records.

## Detailed Analysis

The schema defines 24 models and 24 enums. Important relationship centers:

- `SchoolYear` scopes applications, sections, records, histories, listings, health records, and teacher designations.
- `Learner` stores canonical learner identity and links to yearly applications and records.
- `EnrollmentApplication` captures admission/enrollment intake for a learner and school year.
- `EnrollmentRecord` represents finalized section enrollment.
- `EnrollmentHistory` preserves EOSY historical outcomes.
- `AuditLog` stores immutable activity metadata.
- `Region`, `Province`, `CityMunicipality`, and `Barangay` provide PSGC reference data.

## Dependencies

- `server/prisma/schema.prisma`
- `server/prisma/migrations`
- `server/src/lib/prisma.ts`

## Risks

- School-year-scoped uniqueness must be preserved for learner/application records.
- Historical ledgers and active records can diverge if EOSY workflows are interrupted.
- JSON fields in settings and sectioning config need schema validation at service boundaries.

## Recommendations

- Add database-level indexes for recurring dashboard and sectioning queries as needed.
- Keep migrations small and reversible where possible.
- Document every school-year lifecycle transition in [[School Operations]].

## Related Notes

- [[ERD]]
- [[Tables]]
- [[Relationships]]

