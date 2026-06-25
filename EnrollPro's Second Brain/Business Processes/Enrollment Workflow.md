# Enrollment Workflow

## Purpose

Documents the learner enrollment process and how the code models it.

## Summary

Enrollment flows from public or staff intake through learner profile creation, application validation, document verification, reading assessment or SCP screening when required, sectioning, official enrollment, and later BOSY/EOSY transitions.

## Detailed Analysis

Core database entities:

- `Learner`: canonical identity.
- `EnrollmentApplication`: yearly application/intake state.
- `ApplicationAddress`, `ApplicationFamilyMember`, `EnrollmentPreviousSchool`: BEEF-linked details.
- `EnrollmentRecord`: official section assignment.
- `EnrollmentHistory`: EOSY historical ledger.

Core backend areas:

- `server/src/features/admission`
- `server/src/features/enrollment`
- `server/src/features/enrollment-listing`
- `server/src/features/sections`
- `server/src/features/bosy`
- `server/src/features/remedial`

Core frontend areas:

- `client/src/features/admission`
- `client/src/features/enrollment`
- `client/src/features/intake`
- `client/src/features/bosy`
- `client/src/features/sections`

## Dependencies

- [[Database Architecture]]
- [[Routes]]
- [[School Operations]]
- [[DepEd Compliance]]

## Risks

- Status transitions are numerous and can diverge between backend, frontend tracking UI, and docs.
- Sectioning depends on school-year context, capacity, program type, and learner status.
- Temporary or conditional enrollment must preserve requirements and audit trail.

## Recommendations

- Define a canonical enrollment status transition table.
- Add tests for each permitted status transition.
- Link UI action buttons directly to backend transition names and shared constants.

## Related Notes

- [[Tables]]
- [[Components]]
- [[Services]]

