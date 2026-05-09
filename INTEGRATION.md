# Hinigaran NHS Ecosystem: Master Integration Manual

System: EnrollPro (Core Identity and Admission Provider)
Architect: EnrollPro Lead (BSIT 3-B)
Network Mesh: Tailscale (MagicDNS: buru-degree.ts.net)

## 1. Global Network Directory

All subsystems must use these static addresses for cross-module communication.

| System    | Role                   | Tailscale IP    | API Port | Base URL                                     |
| --------- | ---------------------- | --------------- | -------- | -------------------------------------------- |
| EnrollPro | Core Data Provider     | 100.120.169.123 | 5001     | http://enrollpro.buru-degree.ts.net:5001/api |
| ATLAS     | Timetabling            | 100.88.55.125   | 5001     | http://atlas.buru-degree.ts.net:5001/api     |
| AIMS      | LMS and AI Remediation | 100.92.245.14   | 5001     | http://aims.buru-degree.ts.net:5001/api      |
| SMART     | Academic Records       | 100.93.66.120   | 3000     | http://smart.buru-degree.ts.net:3000/api     |

## 2. Subsystem Integration Protocol (Data Contract)

### A. Connectivity Prerequisites

- MagicDNS: Ensure Tailscale is connected. Always prefer the .ts.net hostname over raw IP.
- Firewall: The EnrollPro host must allow port 5001 for teammate API access.
- Vite: Run frontend dev servers with --host for cross-device testing.

### B. Host-Only Database Access (PostgreSQL)

Only the EnrollPro host machine should connect to PostgreSQL on port 5432.
Teammate machines should not connect to PostgreSQL directly.

Host-side database example:

```env
DATABASE_URL="postgresql://postgres:postgres@enrollpro.buru-degree.ts.net:5432/enrollpro?schema=public"
```

### C. Connection Map (Standard Ports)

Because teammate systems only consume API feeds, the Node/Express server is the gatekeeper.

| Device       | Action                    | Address/Port                |
| ------------ | ------------------------- | --------------------------- |
| Host Machine | Node connects to local DB | localhost:5432              |
| Host Machine | Node listens for team     | 0.0.0.0:5001                |
| Team Machine | React/frontend fetches    | http://100.120.169.123:5001 |

API endpoint bases for this system:

- Main API base: http://100.120.169.123:5001/api
- Integration API base: http://100.120.169.123:5001/api/integration/v1
- Health endpoints:
  - http://100.120.169.123:5001/api/health
  - http://100.120.169.123:5001/api/integration/v1/health

### D. Host Implementation Steps

In your Node/Express host code (index.js):

```js
// Database config (internal to host)
const pool = new Pool({
  host: "localhost",
  port: 5432,
  // ...other credentials
});

// Express config (external to teammates)
const PORT = 5001;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Team can now connect at http://100.120.169.123:5001");
});
```

Open host firewall for port 5001:

- Windows: Firewall and Network Protection -> Advanced Settings -> Inbound Rules -> New Rule -> Allow TCP 5001.
- Linux (ufw): `sudo ufw allow 5001/tcp`

### E. Authorized Data Scope

Subsystems are authorized to fetch:

- Faculty registry for ATLAS scheduling.
- Staff/admin list for system-wide RBAC mapping.
- Enrolled learner masterlist for AIMS and SMART.
- Learner identity fields including LRN, grade level, and section assignment.

## 3. Default Integration Endpoints for Teammates

These public endpoints are intended as direct ingestion feeds for subsystem teams.

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

### Team Fetch Example (React)

Teammate apps should call the host Tailnet API endpoint base, not localhost.

```js
const API_BASE_URL = "http://100.120.169.123:5001/api";
const INTEGRATION_BASE_URL = "http://100.120.169.123:5001/api/integration/v1";

const usersUrl = `${API_BASE_URL}/users`;
const staffFeedUrl = `${INTEGRATION_BASE_URL}/staff`;

async function fetchData(url) {
  const response = await fetch(url);
  const data = await response.json();
  console.log(data);
}

fetchData(usersUrl);
fetchData(staffFeedUrl);
```

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
- Ping works but API fails: Usually CORS config in Express or firewall block on port 5001.

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

## 9. Subsystem API Guide Files (Simple English)

Use these files for teammate setup and API fetch flow.

- Shared quick start (API first rule): docs/features/integration/SUBSYSTEM_API_QUICK_START.md
- ATLAS guide: docs/features/integration/ATLAS_API_GUIDE.md
- AIMS guide: docs/features/integration/AIMS_API_GUIDE.md
- SMART guide: docs/features/integration/SMART_API_GUIDE.md
- Full endpoint spec: docs/features/integration/INTEGRATION_API_V1.md

## 10. Team Quick Check

1. Host runs `tailscale ip -4` and shares the IP with teammates.
2. Teammates confirm they are logged into the same Tailnet.
3. Teammates test reachability:

```bash
ping 100.120.169.123
curl http://100.120.169.123:5001/api/health
```

If ping works but API calls fail, check CORS and host firewall rules.
