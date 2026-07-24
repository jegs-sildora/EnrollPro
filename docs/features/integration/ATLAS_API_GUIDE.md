# ATLAS API Guide

Last reviewed: 2026-07-24

## Boundary

ATLAS owns schedules and teaching loads. EnrollPro owns personnel identity, employee number, section structure, adviser assignment, enrollment, and school-year context.

EnrollPro stores `TeacherSchedulePeriod` only as the synchronized SF7 reporting snapshot.

## Configuration

ATLAS reads EnrollPro through:

```text
ENROLLPRO_INTEGRATION_BASE_URL=https://configured-enrollpro-host/api/integration/v1
```

EnrollPro connects back to ATLAS with server-only values:

```text
ATLAS_API_BASE_URL=https://configured-atlas-host
ATLAS_API_KEY=server-secret
ATLAS_SCHOOL_ID=optional-external-school-id
```

## EnrollPro Feeds

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Verify integration availability |
| GET | `/school-year` | Resolve active or explicit school year |
| GET | `/default/faculty` | Active faculty, employee numbers, roles, designations, and advisership |
| GET | `/sections` | Grade, program, section, capacity, and adviser context |

## EnrollPro Trigger And Snapshot Routes

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/integration/atlas/sync-faculty` | Ask ATLAS to reconcile EnrollPro faculty |
| GET | `/api/integration/atlas/faculty/:id/teaching-load` | Read a teacher teaching load through EnrollPro |
| POST | `/api/sf7/sync-atlas` | Replace EnrollPro SF7 schedule snapshots with published ATLAS assignments |
| GET | `/api/teachers/:id/schedule-periods` | Read the stored school-year SF7 snapshot |
| PUT | `/api/teachers/:id/schedule-periods` | Authorized manual replacement of the reporting snapshot |

## Matching

`Teacher.employeeId` maps to the ATLAS employee code. School and school-year identifiers must be sent explicitly. Invalid, unpublished, or malformed assignments are skipped with a reason; they are not fabricated.

## Rollover

ATLAS refreshes school-year, section, faculty, and adviser context only after the EnrollPro atomic rollover commits. New sections contain no advisers and require new-year assignment.

See [EnrollPro API](ENROLLPRO-API.md) and [Personnel and SF7](../personnel/PERSONNEL_AND_SF7.md).
