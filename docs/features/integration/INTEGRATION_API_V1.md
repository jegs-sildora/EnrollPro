# Integration API v1

Last reviewed: 2026-07-24

Base path:

```text
https://configured-enrollpro-host/api/integration/v1
```

The configured host may be local, private-network, or deployed. Consumers must use environment configuration rather than a hard-coded address.

## Endpoints

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public compatibility | EnrollPro database and companion connectivity |
| GET | `/school-year` | Public compatibility | Active or explicit school-year context |
| GET | `/learners` | Public compatibility | Paginated current or archived learner roster |
| GET | `/students` | Public alias | Alias of `/learners` |
| GET | `/faculty` | Public compatibility | Paginated faculty and designation context |
| GET | `/teachers` | Public alias | Alias of `/faculty` |
| GET | `/staff` | Public compatibility | Active staff accounts excluding the MRF compatibility role |
| GET | `/sections` | Public compatibility | Sections, capacity, enrollment count, grade, program, and adviser |
| GET | `/sections/:sectionId/learners` | Public compatibility | Current or archived section roster |
| GET | `/default/faculty` | Public compatibility | ATLAS-ready faculty feed |
| GET | `/default/smart/students` | Public compatibility | SMART-ready learner feed |
| GET | `/default/aims/context` | Public compatibility | AIMS-ready learner context |
| GET | `/default/mrf/identities` | `X-Integration-Key` | Minimized MRF identity groups |

## Query Rules

- `schoolYearId` selects a specific current or archived year.
- Paginated routes accept `page` and `limit`.
- Omitted school-year scope resolves to the active year.
- Invalid identifiers return a structured error instead of silently using another year.

## Data Rules

Current rosters are built from active application and enrollment records. Archived rosters use immutable history where supported. Consumers should store EnrollPro stable IDs together with LRN or employee ID and school-year ID.

## Security

Public compatibility endpoints must remain data-minimized. The MRF feed requires `MRF_INTEGRATION_API_KEY`. Future sensitive feeds should use separate consumer-specific keys rather than widening public responses.

## Refresh Rules

Poll or refresh on a bounded schedule during normal operations. After rollover, do not switch context until `/school-year` returns the newly committed active year.

See [Microservice Architecture](../../../ARCHITECTURE_MICROSERVICES.md) and [EnrollPro API](ENROLLPRO-API.md).
