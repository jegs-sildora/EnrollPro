# School Year Operations

Last reviewed: 2026-07-24

## Calendar And Phase

School-year settings store the label, opening and closing dates, classes start, term format, phase, and active or archived state. Versioned calendar policies move through Draft, Approved, and Applied.

Only first-time initialization may directly activate a school year. Once operational records exist, the next active year must be created through atomic rollover.

## Operational Phases

- Official Enrollment permits learner intake, confirmation, verification, and sectioning.
- Classes Ongoing permits normal class operations and authorized late walk-in processing.
- EOSY Closing locks intake and prepares final outcomes and forms.

## EOSY Readiness

Rollover requires:

- source year in EOSY Closing
- every section finalized
- every active learner carrying a finalized SMART outcome
- dropped and transferred learners carrying a local final status
- current SF5 artifact for each section
- current school-wide SF6 artifact
- approved target-year calendar policy
- no conflicting operational records in the target-year shell

SF5 and SF6 previews do not satisfy readiness. Authorized staff must record checksum-backed artifacts.

## Atomic Rollover

The rollover runs in a serializable Prisma transaction protected by a PostgreSQL advisory transaction lock. It:

1. Rechecks readiness.
2. Archives source learner outcomes in `EnrollmentHistory`.
3. Applies the promotion matrix.
4. Clones section name, capacity, program, order, and ranking.
5. Copies no learners and no advisers into target sections.
6. Creates eligible pending confirmations and remedial holds.
7. Archives Grade 10 completers and departed learners.
8. Revokes source-year adviserships.
9. Removes source live enrollment records.
10. Applies the approved calendar and activates the target year.
11. Records the rollover audit event.

Realtime and companion-system invalidations are broadcast only after commit.

## Ownership

SMART final academic outcomes must be synchronized before rollover. ATLAS schedules, AIMS interventions, and MRF maintenance records remain in their owning systems and are not copied by rollover.

See [School Year Lifecycle](../integration/ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md).
