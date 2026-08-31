# EnrollPro Microservice Architecture

Last reviewed: 2026-08-31

## Purpose

EnrollPro is one system in a school operations ecosystem. Each system keeps its own database and remains authoritative only for its assigned domain. Integration feeds share context; they do not transfer ownership.

## Ownership Matrix

| System | Source of truth | Consumes from EnrollPro | Returns to EnrollPro |
| --- | --- | --- | --- |
| EnrollPro | learner and personnel identity, enrollment, section placement, school-year context, school-form workflow | finalized SMART outcomes, published ATLAS schedules | identity, roster, section, personnel, and school-year context |
| SMART | grades, learning-area results, promotion outcomes, and attendance | learners, sections, advisers, and active school year | final published EOSY outcomes |
| ATLAS | schedules and teaching loads | active faculty, sections, advisers, and school year | published faculty assignments for SF7 |
| AIMS | learning intervention and LMS activity | learner, grade, section, program, and remedial context | intervention data remains in AIMS unless a future reviewed contract is added |
| MRF | maintenance, facilities, and waste-management operations | minimized learner, personnel, staff-role, and school-year identity | maintenance transactions remain in MRF |

## EnrollPro Boundary

EnrollPro owns:

- stable learner and personnel identifiers
- current application and enrollment state
- official class placement and SF1 roster
- school-year and academic-phase context
- section structure, capacity, and class adviser
- current personnel service status
- immutable enrollment history and recorded SF5 or SF6 artifacts
- synchronization provenance and readiness state for finalized SMART outcomes

EnrollPro does not own:

- SMART grades or attendance
- ATLAS schedule authoring
- AIMS intervention records
- MRF maintenance or waste records
- No Early Registration, reading assessment, enrollment listing, hardware, or Internet of Things workflows

Teachers and class advisers do not enter or finalize academic results in
EnrollPro. SMART publishes the academic results. EnrollPro synchronizes them,
validates their learner and school-year scope, records school-form readiness,
and uses them during atomic rollover.

## Connectivity

Companion systems receive the EnrollPro base URL through environment configuration. Do not hard-code local IP addresses, Tailscale hostnames, or production domains in source.

Recommended variables:

```text
ENROLLPRO_BASE_URL=https://configured-enrollpro-host
ENROLLPRO_INTEGRATION_BASE_URL=https://configured-enrollpro-host/api/integration/v1
```

Private network transport may use Tailscale or another school-approved network. Transport choice does not change the API or ownership contract.

## Authentication

- Staff and teacher routes use an authenticated EnrollPro session or bearer token.
- Learner routes use a learner-scoped JWT.
- The MRF identity feed uses `X-Integration-Key`.
- Machine integration feeds require an approved service key and contain only the fields needed by their documented consumer.
- SMART, AIMS, and ATLAS must send their exact login page as `returnTo` and refuse login when EnrollPro credential verification returns `PASSWORD_CHANGE_REQUIRED`. They navigate to the returned absolute EnrollPro password-change URL and create their own session only after EnrollPro redirects back and the user signs in with the replacement password.

Integration keys and user credentials must never appear in logs, responses, or committed documentation.

## School-Year Synchronization

Companion systems may read current context during normal operations. The active school year changes only after EnrollPro completes its atomic rollover transaction.

System-specific rollover behavior is documented separately from API contracts.
The runbooks define historical-data treatment, role-facing states, and the
post-commit reconciliation required by each companion system.

Downstream refresh order:

1. EnrollPro commits history, learner outcome snapshots, cloned empty sections, the reviewed next-year calendar, and active-year state.
2. EnrollPro broadcasts school-year and integration invalidations.
3. SMART refreshes active learners and sections.
4. ATLAS refreshes faculty, sections, and adviser context.
5. AIMS refreshes learner and class context.
6. MRF refreshes minimized identities.

No downstream system should switch years before EnrollPro completes the atomic rollover and publishes the new active school year.

## Failure Handling

- Consumers retry read-only feeds with bounded exponential backoff.
- A failed companion call must not create fabricated data in EnrollPro.
- SMART final outcomes must be complete and published before EOSY readiness passes.
- If ATLAS is unavailable, EnrollPro may use its last synchronized SF7 schedule snapshot but does not become the live scheduling owner.
- Consumers should treat explicit school-year IDs as immutable historical scope.

## References

- [EnrollPro API](docs/features/integration/ENROLLPRO-API.md)
- [School Year Lifecycle](docs/features/integration/ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md)
- [ATLAS School Year Rollover](docs/features/integration/ATLAS-SCHOOL-YEAR-ROLLOVER.md)
- [SMART School Year Rollover](docs/features/integration/SMART-SCHOOL-YEAR-ROLLOVER.md)
- [AIMS School Year Rollover](docs/features/integration/AIMS-SCHOOL-YEAR-ROLLOVER.md)
- [Subsystem Quick Start](docs/features/integration/SUBSYSTEM_API_QUICK_START.md)
