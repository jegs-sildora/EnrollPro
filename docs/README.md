# EnrollPro Documentation

This index lists the maintained EnrollPro product documentation. The implementation remains authoritative when a document becomes stale.

Last reviewed: 2026-07-24

## Repository And Core

| Document | Owner | Purpose |
| --- | --- | --- |
| [Repository README](../README.md) | Engineering | Setup, commands, structure, and source-of-truth order |
| [Microservice Architecture](../ARCHITECTURE_MICROSERVICES.md) | Architecture | Ownership boundaries between EnrollPro, SMART, ATLAS, AIMS, and MRF |
| [System Architecture](core/SYSTEM_ARCHITECTURE.md) | Engineering | Current application structure, runtime, routes, and realtime behavior |
| [Data Model and Status](core/DATA_MODEL_AND_STATUS.md) | Data and Engineering | Current Prisma entities, status meanings, and history rules |
| [Security and Access](core/SECURITY_AND_ACCESS.md) | Security and Engineering | Authentication, authorization, secrets, privacy, and audit controls |
| [Development Workflow](core/DEVELOPMENT_WORKFLOW.md) | Engineering | Implementation, migration, documentation, and verification workflow |

## Operational Features

| Document | Owner | Purpose |
| --- | --- | --- |
| [Master Dashboard](features/dashboard/MASTER_DASHBOARD.md) | Product and Registrar | Phase-aware operational summary and actions |
| [Learner Enrollment and Sectioning](features/enrollment/LEARNER_ENROLLMENT_AND_SECTIONING.md) | Registrar | Intake, verification, temporary enrollment, sectioning, and SF1 |
| [Learner Records](features/learners/LEARNER_RECORDS.md) | Registrar | Learner identity, contacts, health, portal, and lifecycle records |
| [Personnel and SF7](features/personnel/PERSONNEL_AND_SF7.md) | School Head and Administrator | Personnel profiles, advisership, schedules, and SF7 |
| [School Year Operations](features/school-year/SCHOOL_YEAR_OPERATIONS.md) | School Head and Registrar | Calendar policy, phases, EOSY forms, and rollover |
| [System Administration](features/system/SYSTEM_ADMINISTRATION.md) | System Administrator | Configuration, accounts, activity logs, and health checks |
| [Design System](ui-ux/DESIGN_SYSTEM.md) | UI and Accessibility | EnrollPro visual, motion, responsive, and wording standards |

## Integration

| Document | Owner | Purpose |
| --- | --- | --- |
| [EnrollPro API](features/integration/ENROLLPRO-API.md) | API Engineering | Mounted API catalog and authentication requirements |
| [School Year Lifecycle](features/integration/ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md) | Architecture | BOSY, classes ongoing, EOSY, rollover, and downstream refresh order |
| [Integration API v1](features/integration/INTEGRATION_API_V1.md) | Integration Engineering | Public and protected downstream feed contracts |
| [Subsystem Quick Start](features/integration/SUBSYSTEM_API_QUICK_START.md) | Companion Teams | Minimum setup for SMART, ATLAS, AIMS, and MRF |
| [SMART API Guide](features/integration/SMART_API_GUIDE.md) | SMART and EnrollPro Teams | Identity context and final academic outcome exchange |
| [ATLAS API Guide](features/integration/ATLAS_API_GUIDE.md) | ATLAS and EnrollPro Teams | Faculty context and schedule synchronization |
| [AIMS API Guide](features/integration/AIMS_API_GUIDE.md) | AIMS and EnrollPro Teams | Learner and class context for interventions |
| [MRF API Guide](features/integration/MRF_API_GUIDE.md) | MRF and EnrollPro Teams | Minimized personnel and learner identity feed |

## Maintenance Rules

- Update operational documents when user-visible workflow or terminology changes.
- Update integration documents whenever a mounted route, request contract, or ownership boundary changes.
- Update data documentation in the same change as a Prisma migration.
- Run `pnpm docs:check` before completing documentation work.
- Do not document target-state features as implemented.
- EnrollPro does not provide Early Registration, reading assessment, enrollment listing, hardware, or Internet of Things workflows.
