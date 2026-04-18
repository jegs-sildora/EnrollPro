# Hinigaran NHS Ecosystem: Master Integration Manual

System: EnrollPro (Core Identity and Admission Provider)
Architect: EnrollPro Lead (BSIT 3-B)
Network Mesh: Tailscale (MagicDNS: buru-degree.ts.net)

## 1. Global Network Directory

All subsystems must use these static addresses for cross-module communication.

| System    | Role                   | Tailscale IP    | API Port | Base URL                                     |
| --------- | ---------------------- | --------------- | -------- | -------------------------------------------- |
| EnrollPro | Core Data Provider     | 100.120.169.123 | 5000     | http://enrollpro.buru-degree.ts.net:5000/api |
| ATLAS     | Timetabling            | 100.88.55.125   | 5000     | http://atlas.buru-degree.ts.net:5000/api     |
| AIMS      | LMS and AI Remediation | 100.92.245.14   | 5000     | http://aims.buru-degree.ts.net:5000/api      |
| SMART     | Academic Records       | 100.93.66.120   | 3000     | http://smart.buru-degree.ts.net:3000/api     |

## 2. Subsystem Integration Protocol (Data Contract)

### A. Connectivity Prerequisites

- MagicDNS: Ensure Tailscale is connected. Always prefer the .ts.net hostname over raw IP.
- Firewall: The EnrollPro host must keep ports 5000 (API) and 5432 (PostgreSQL) open.
- Vite: Run frontend dev servers with --host for cross-device testing.

### B. Shared Database Access (PostgreSQL)

To fetch students, teachers, and registrars directly from EnrollPro host:

```env
DATABASE_URL="postgresql://postgres:postgres@enrollpro.buru-degree.ts.net:5432/enrollpro?schema=public"
```

### C. Authorized Data Scope

Subsystems are authorized to fetch:

- Faculty registry for ATLAS scheduling.
- Staff/admin list for system-wide RBAC mapping.
- Enrolled learner masterlist for AIMS and SMART.
- Learner identity fields including LRN, grade level, and section assignment.

## 3. Default Integration Endpoints for Teammates

These protected endpoints are intended as direct ingestion feeds for subsystem teams.

All endpoints below require integration key headers:

- X-Integration-Key: <key>
- Authorization: Bearer <key>

| Consumer System | Endpoint                                   | Purpose                                           |
| --------------- | ------------------------------------------ | ------------------------------------------------- |
| ATLAS           | /api/integration/v1/default/atlas/faculty  | Faculty and designation metadata for scheduling   |
| SMART           | /api/integration/v1/default/smart/students | Enrolled learner roster with LRN, grade, section  |
| AIMS            | /api/integration/v1/default/aims/context   | Learner context for interventions and remediation |
| Shared Ops      | /api/integration/v1/staff                  | Admin and registrar roster                        |

Operational boundary:

- EnrollPro endpoints are read-only ingestion feeds.
- ATLAS still performs scheduling operations in ATLAS.
- SMART still performs academic record operations in SMART.
- AIMS still performs assessment and remediation operations in AIMS.

## 4. Real-Time Data Flow Logic

- Single source of truth: Data is not copied between devices; one database lives on EnrollPro host.
- Instant reflectivity: New records encoded in EnrollPro become fetchable by connected systems immediately.
- Stable host requirement: EnrollPro core provider machine must stay online for dependent integrations.

## 5. Developer URL Guide (EnrollPro Team)

| Scenario           | URL                                      | Purpose                        |
| ------------------ | ---------------------------------------- | ------------------------------ |
| Local coding       | http://localhost:5173                    | Individual development speed   |
| Team testing       | http://enrollpro.buru-degree.ts.net:5173 | Verify shared network behavior |
| Final presentation | http://enrollpro.buru-degree.ts.net:5173 | Mesh-network demo              |

## 6. Troubleshooting Checklist

- Connection refused: Verify backend and PostgreSQL are both running on EnrollPro host.
- CORS error: Update CLIENT_URLS in server .env to include requester Tailscale hostname.
- DNS fail: Use fallback host 100.120.169.123 temporarily.
- Data not found: Ensure learner status is ENROLLED or COMPLETED as required by consumer flow.

## 7. Security Rule (Mandatory)

- Never use real student data from Hinigaran National High School during development.
- Use generated dummy data for all integration tests and demos.
- Keep Learner Reference Number (LRN) as shared identity key across EnrollPro, ATLAS, AIMS, and SMART for DepEd-aligned interoperability.

## 8. Seed and Verification Steps

1. Run base seed:

```bash
pnpm --filter server run db:seed
```

2. Run sample integration seed:

```bash
pnpm --filter server run db:seed-sample-integration
```

3. Validate feed docs and contracts:

- docs/features/integration/INTEGRATION_API_V1.md
- sample-integration/README.md

4. Validate demo page:

- http://localhost:5173/sample-integration
