# Learner Records

Last reviewed: 2026-07-24

## Learner Identity

The Learner Registry stores the stable learner profile. The 12-digit Learner Reference Number is the primary school identity when available. Duplicate LRNs are rejected.

Core profile data includes legal name, sex, birthdate, mother tongue, citizenship, Indigenous Peoples information when declared, current and permanent addresses, and current learner status.

## Family And Contact

Parent and guardian records are stored with their relationship and contact details. The learner primary contact number must come from the selected father, mother, or guardian record.

## Health And Documentary Records

Health records are protected learner data and are available only to authorized users. Documentary readiness is calculated from the required records and accepted alternatives. Missing documents can place an enrolled learner in temporary-enrollment follow-up.

## Enrollment And History

`EnrollmentApplication` stores the school-year intake state. `EnrollmentRecord` stores the live official section placement. `EnrollmentHistory` preserves the immutable source-year result after rollover.

The registry distinguishes active learners, JHS completers, dropped learners, transferred-out learners, and other inactive records.

## Portal Access

Learner accounts use learner-scoped authentication. Authorized staff can manage portal access and reset credentials. Passwords are never returned by learner profile APIs.

## Lifecycle Actions

Authorized staff may update permitted profile fields, record documentary follow-up, process a transfer, mark a dropout, and inspect historical placement. Archived school-year data remains read-only.

## Integration

Companion systems receive only the learner identity and school context required by their ownership boundary. See [Microservice Architecture](../../../ARCHITECTURE_MICROSERVICES.md).

