# Subsystem API Quick Start (ATLAS, AIMS, SMART)

This guide is for teammate systems that need to fetch data from EnrollPro.

It gives one shared setup flow for ATLAS, AIMS, and SMART.

## One Important Rule

EnrollPro API must be ready first before your subsystem fetch starts.

If your teammate runs one of these commands on their own machine:

- `pnpm dev`
- `npm run dev`
- `npm run serve`

their app should wait for EnrollPro API health before any fetch job runs.

## 1. Required Values

Set these values in your subsystem environment file.

```env
ENROLLPRO_BASE_URL="https://dev-jegs.buru-degree.ts.net"
ENROLLPRO_INTEGRATION_BASE_URL="https://dev-jegs.buru-degree.ts.net/api/integration/v1"
```

Notes:

- Use Tailnet DNS if your team prefers hostname.

## 1.1 Connection Map (Host as Gatekeeper)

With standard ports (PostgreSQL 5432 and Node 5002), only the host machine needs database access.
Teammate devices should call API endpoints only.

| Device       | Action                    | Address/Port                |
| ------------ | ------------------------- | --------------------------- |
| Host Machine | Node connects to local DB | localhost:5432              |
| Host Machine | Node listens for team     | 0.0.0.0:5002                |
| Team Machine | React/frontend fetches    | https://dev-jegs.buru-degree.ts.net |

API endpoint bases for this system:

- Main API base: `https://dev-jegs.buru-degree.ts.net/api`
- Integration API base: `https://dev-jegs.buru-degree.ts.net/api/integration/v1`

## 2. Start Order (Must Follow)

### Step A: Start EnrollPro API first (host machine)

From EnrollPro root:

```bash
pnpm run dev
```

or API only:

```bash
pnpm run dev:server
```

### Step A.1: Host Implementation and Firewall Checklist

In your Node/Express code (index.js), connect to PostgreSQL locally, then expose API on all host interfaces:

```js
// Database config (internal to host)
const pool = new Pool({
  host: "localhost",
  port: 5432,
  // ...other credentials
});

// Express config (external to teammates)
const PORT = 5002;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Team can now connect at https://dev-jegs.buru-degree.ts.net");
});
```

Open host firewall for port 5002:

- Windows: Firewall and Network Protection -> Advanced Settings -> Inbound Rules -> New Rule -> Allow TCP 5002.
- Linux (ufw): `sudo ufw allow 5002/tcp`

### Step B: Start your subsystem app (your machine)

Use your project command:

```bash
pnpm dev
```

or

```bash
npm run dev
```

or

```bash
npm run serve
```

### Step B.1: Enforce API-first inside your scripts (recommended)

If you want automatic protection, add a pre-check script.

Example `package.json` script pattern:

```json
{
  "scripts": {
    "predev": "node scripts/wait-for-enrollpro-api.mjs",
    "dev": "your-dev-command",
    "preserve": "node scripts/wait-for-enrollpro-api.mjs",
    "serve": "your-serve-command"
  }
}
```

Example `scripts/wait-for-enrollpro-api.mjs`:

```js
const base = process.env.ENROLLPRO_BASE_URL || "https://dev-jegs.buru-degree.ts.net";

async function wait(url, headers = {}) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`API check failed: ${url}`);
}

await wait(`${base}/api/health`);
await wait(`${base}/api/integration/v1/health`);

console.log("EnrollPro API is ready.");
```

### Step C: Run health checks before first fetch

Run these checks from your machine.

#### Public health check

```bash
curl https://dev-jegs.buru-degree.ts.net/api/health
```

Expected:

```json
{ "ok": true }
```

#### Integration health check (public)

```bash
curl https://dev-jegs.buru-degree.ts.net/api/integration/v1/health
```

Expected `data.status` is `ok`.

#### Faculty endpoint check

```bash
curl https://dev-jegs.buru-degree.ts.net/api/integration/v1/default/faculty
```

Expected HTTP 200.

## 3. Add API-First Guard in Your Startup

Use a simple wait loop in your subsystem app boot code.

```js
async function waitForEnrollPro(url, headers = {}) {
  const tries = 30;

  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return true;
    } catch {}

    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error("EnrollPro API is not ready");
}

async function boot() {
  const base = process.env.ENROLLPRO_BASE_URL;

  await waitForEnrollPro(`${base}/api/health`);
  await waitForEnrollPro(`${base}/api/integration/v1/health`);

  // Start your app fetch jobs only after checks pass.
  startSubsystemSync();
}

boot();
```

## 4. Shared Endpoint Map

Public default feeds:

- ATLAS: `GET /api/integration/v1/default/faculty`
- AIMS: `GET /api/integration/v1/default/aims/context`
- SMART: `GET /api/integration/v1/default/smart/students`
- MRF: `GET /api/integration/v1/default/mrf/identities` with `X-Integration-Key`

Shared support feed (public):

- Staff list: `GET /api/integration/v1/staff`

Generic compatibility feeds:

- `GET /api/integration/v1/faculty`
- `GET /api/integration/v1/staff`
- `GET /api/integration/v1/learners?schoolYearId=<id>`

## 4.1 How Teammates Fetch (React Example)

Teammate apps should use the host Tailnet API endpoint base, not `localhost`.

```js
// Use this system's Tailnet API endpoint base
const API_BASE_URL = "https://dev-jegs.buru-degree.ts.net/api";
const INTEGRATION_BASE_URL = "https://dev-jegs.buru-degree.ts.net/api/integration/v1";

// Example: main API route
const usersUrl = `${API_BASE_URL}/users`;

// Example: integration route
const staffFeedUrl = `${INTEGRATION_BASE_URL}/staff`;

async function fetchData(url) {
  const response = await fetch(url);
  const data = await response.json();
  console.log(data);
}

fetchData(usersUrl);
fetchData(staffFeedUrl);
```

## 5. Common Error Meanings

- `400`: Bad query value (for example wrong `schoolYearId`).
- `404`: Scoped data not found.
- `401`: Missing or invalid MRF integration key.
- `503`: API or an external dependency is degraded.

## 6. Troubleshooting

1. API health fails:

- Confirm EnrollPro server is running.
- Confirm port `5002` is open.

2. Integration health fails:

- Confirm EnrollPro API process is running.

3. MRF identity feed returns 401:

- Confirm MRF sends the same `X-Integration-Key` value configured as `MRF_INTEGRATION_API_KEY` on EnrollPro.

4. Works in browser but fails in app:

- Add startup wait logic before your first fetch.
- Do not start sync jobs at import time.

5. Ping works but API still fails:

- Usually CORS policy in Express or host firewall blocking port 5002.

6. Team needs host details quickly:

- Host Tailscale IPv4 from `tailscale ip -4`
- API Port: `5002`
- Team members must be in the same Tailnet (or have shared access)

## 7. Next Guides

- [ATLAS API Guide](./ATLAS_API_GUIDE.md)
- [AIMS API Guide](./AIMS_API_GUIDE.md)
- [SMART API Guide](./SMART_API_GUIDE.md)
- [Integration API v1 Spec](./INTEGRATION_API_V1.md)
