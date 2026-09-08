# ENROLLPRO HANDOFF — Student Portal Authentication Gap & API Documentation Request

> **To:** EnrollPro Development / Integration Team
> **From:** SORTv2 (School Waste-Management System) Integration Owner
> **Date:** 2026-09-07
> **Priority:** HIGH — student login to SORT is blocked by this
> **Environment:** `https://dev-jegs.buru-degree.ts.net/api` (dev instance)
> **Please respond with:** (1) answers to Section 5, (2) the Markdown API catalog described in Section 6

---

## 1. TL;DR

SORTv2 delegates **all** authentication to EnrollPro (no local passwords — strict mirror policy). Staff authentication via `POST /auth/login` works perfectly. **Learner/portal accounts cannot authenticate through the same endpoint**, even when the password shown in the EnrollPro admin panel ("PASSWORD CONTROL: `DepEd2026!`") is used. Our probes indicate `POST /auth/login` validates `accountName` as a **staff Employee ID** (see evidence in Section 4). We need to know the correct way for learners to authenticate via the API — or confirmation that `/auth/login` supports learners and what we are doing wrong.

---

## 2. Who we are & how we currently consume EnrollPro

SORTv2 is the school's waste-management/reporting platform. All user accounts are mirrored from EnrollPro; passwords are **never** stored locally — every SORT login is forwarded to EnrollPro for validation.

**Current consumption inventory (complete list — nothing else is called):**

| # | Endpoint | Method | Headers | Purpose | Frequency |
|---|----------|--------|---------|---------|-----------|
| 1 | `/auth/login` | POST | — (public, JSON body) | Delegated credential check on every SORT login | Per login attempt |
| 2 | `/integration/v1/school-year` | GET | `X-Integration-Key` | Active SY context + term dates | Each sync run |
| 3 | `/integration/v1/learners` | GET | `X-Integration-Key`, `x-school-year-context-id` | Learner directory pull (paginated: `page`, `limit=200`) | Each sync run |
| 4 | `/integration/v1/faculty` | GET | `X-Integration-Key`, `x-school-year-context-id` | Faculty directory pull (paginated) | Each sync run |
| 5 | `/integration/v1/staff` | GET | `X-Integration-Key` | Staff directory pull (paginated) | Each sync run |

Sync cadence: MANUAL by default; optional AUTO via cron at a configurable interval (min 5 minutes).

**What we already use from the learner payload:** `learner.lrn`, `learner.externalId`, names, `gradeLevel.name`, `section.name`, `section.programType`, `schoolYear`, and `learner.portalAccount` (`accountName`, `isActive`, `mustChangePassword`) to flag login-ready accounts.

---

## 3. The blocking problem

Students cannot log in to SORT. Staff can. The failure happens at the EnrollPro delegation step.

**Exact reproduction (any REST client):**

```bash
# Staff — WORKS (200, JWT returned)
curl -X POST https://dev-jegs.buru-degree.ts.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"accountName":"1234501","password":"DepEdSY2026!"}'

# Learner — FAILS (401), account IS active in EnrollPro admin panel
curl -X POST https://dev-jegs.buru-degree.ts.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"accountName":"202700000004","password":"DepEd2026!"}'
```

**Learner `202700000004` state in EnrollPro admin (Learner Profile page):**
- Portal Access: **ALLOW LOGIN (ACTIVE)**
- `portalAccount`: `{ accountName: "202700000004", isActive: true, mustChangePassword: false }`
- Password Control field shows default: `DepEd2026!`

**Result with those exact credentials:** `401 {"message":"Invalid employee ID or password"}`

Failing learners observed in SORT server logs (all returned 401 from EnrollPro): `202900000007`, `202900000004`, `202700000004`, `202900000006`. One learner (`117463100000`) has no portal account at all — that case we handle cleanly.

---

## 4. Evidence that points to the root cause

All probes run 2026-09-07 against the dev instance:

| Probe | Result | Interpretation |
|-------|--------|----------------|
| `POST /auth/login` `{accountName:"1234501", password:"DepEdSY2026!"}` (staff) | **200** + JWT | Endpoint works for staff accounts |
| `POST /auth/login` `{accountName:"202700000004", password:"DepEd2026!"}` (learner) | **401** `"Invalid employee ID or password"` | Learner accountName rejected |
| `POST /auth/login` `{accountName:"202900000004", password:"DepEd2026!"}` (learner) | **401** same | Not account-specific |
| `POST /auth/login` `{lrn:"202700000004", ...}` (different field names: `lrn`, `identifier`, `email`, `username`) | **400** `Validation failed: accountName — Invalid input: expected string, received undefined` | Payload contract is strictly `{accountName, password}` |
| `POST /auth/login` `{accountName:"", password:"x"}` | **400** `Validation failed: accountName — **Employee ID is required**` | The field's own validation labels it an **Employee ID** |
| `GET /auth/learner-login`, `/auth/student-login`, `/learners/login`, `/portal/auth/login`, `/integration/v1/learners/login` | **404** | No alternative learner auth endpoint found at plausible paths |
| `GET /openapi.json`, `/swagger.json`, `/docs`, `/api-docs`, `/v1`, `/integration/v1` | **404** | **No API discovery surface exists** — we cannot self-serve endpoint discovery |

**Working hypothesis (please confirm or correct):** `POST /auth/login` authenticates against the staff/user directory, while learner `portalAccount`s authenticate through a different mechanism (different endpoint, different client flow, or a cookie/session-based web portal not exposed as a REST contract). The admin panel's "PASSWORD CONTROL: `DepEd2026!`" may also be only the *reset default* (applied when "RESET TO DEFAULT PASSWORD" is clicked), not the learner's current password.

**Staff JWT payload (for your reference, from the 200 response):** `{ userId: 133, roles: ["SYSTEM_ADMIN"], mustChangePassword: false, iat, exp = iat + 86400 }`.

**Quick disambiguation experiment (whoever has admin access can run it in 1 minute):**
1. In the EnrollPro admin panel, open learner `202700000004` and click **RESET TO DEFAULT PASSWORD**.
2. Retry the curl above with `DepEd2026!`.
3. If it now returns 200 → `/auth/login` does support learners and the issue is that defaults are not applied at account creation. If it still 401s → the endpoint is staff-only and we need the real learner auth contract.

---

## 5. PRIMARY ASKS (blocking — please answer these)

| # | Ask | Why we need it |
|---|-----|----------------|
| A1 | **How does a learner authenticate via the API?** Exact endpoint, method, request body, success response shape, and error responses. If it is a web-portal-only flow (no REST contract), tell us that explicitly so we can escalate with our stakeholders. | Student login to SORT is impossible until this is resolved |
| A2 | **Is the "Password Control" value in the admin panel the learner's *current* password or only a reset default?** What is the actual initial password when a portal account is created? | Determines whether "use your EnrollPro password" guidance is even actionable for new learners |
| A3 | **Error semantics of `/auth/login`:** is 401 always "bad credentials", or can it also mean "account inactive/not found"? Does 403 ever mean `mustChangePassword`? Please provide the full status-code map. | We currently distinguish unreachable / wrong-password / must-change-password from a single opaque message |
| A4 | **Account lockout / rate-limit policy on `/auth/login`.** After how many failures is an account or IP locked, for how long, and how is lockout signaled in responses? | We forward every SORT login attempt; we must not cause lockouts on learners' behalf, and we must relay lockout messages accurately |

---

## 6. PRIMARY ASK — Markdown API catalog ("how to pull those API endpoints")

**Please deliver a Markdown document (e.g., `ENROLLPRO_API_CATALOG.md`) describing how to enumerate and invoke every API endpoint available to us.** We could not find any discovery surface (no OpenAPI/Swagger, `/integration/v1` returns 404, no docs route), so a written catalog is the only way for us to integrate confidently.

For **each** endpoint, please include:

- **Path + HTTP method** (full path, including the `/api` prefix)
- **Authentication** — `X-Integration-Key` vs JWT vs public; required headers (including `x-school-year-context-id` behavior when present/omitted)
- **Request schema** — all params (query, path, body) with types, defaults, and validation rules
- **Response schema** — success shape with a real example payload, including pagination envelope (`data[]`, `meta.page/limit/total/totalPages`) where applicable
- **Error responses** — status codes and bodies (machine-readable codes if they exist)
- **Notes** — ordering guarantees, filters (`schoolYearId` etc.), soft-deletion behavior, and anything non-obvious

Additionally, in the same document:

- **A section on endpoint discovery/maintenance:** how you recommend we stay current (is there an internal OpenAPI spec you can export and share? a changelog feed? will we be notified of breaking changes?)
- **Versioning policy** for the integration API, and whether `/integration/v1` will ever break
- **The auth contract in full** (Section 5 asks): learner + staff flows, token lifecycle, refresh/revocation, and `mustChangePassword` flow semantics (what happens on the API when a must-change user authenticates)

---

## 7. Future asks (non-blocking — include in the catalog doc where possible)

So we can plan ahead; answers in the same Markdown deliverable are ideal:

1. **Password lifecycle API:** programmatic reset-to-default, forced-change flows, and how `mustChangePassword` transitions to `false`.
2. **Webhooks / event notifications** for account lifecycle (learner created, deactivated, password reset, section change) — with signature scheme and retry policy. This would let us move from full-directory polling to event-driven sync.
3. **Incremental sync:** `updatedSince` filter or `updatedAt` fields on the integration list endpoints — we currently pull the entire directory every run.
4. **Sandbox/test accounts:** one staff + two learner accounts on the dev instance with known passwords, documented, for integration testing (ours break whenever dev data is reset).
5. **Integration key management:** rotation procedure, scopes (exactly what does `X-Integration-Key` authorize?), and whether per-consumer keys are supported.
6. **Uptime/SLA guidance** for dev and prod instances, and any IP allowlisting requirements — we fail logins closed when EnrollPro is unreachable (strict delegation), so outages = no SORT logins.
7. **Bulk operations:** bulk portal-account provisioning, bulk password reset, and export formats.
8. **Data retention & GDPR-ish concerns:** what learner fields are safe for us to mirror and display to school staff.
9. **Multi-school / multi-deployment notes** if the platform hosts other schools: anything that changes per-tenant (base URL, keys, school-year IDs).
10. **Environment parity:** dev vs production base URLs and how contract differences (if any) are managed.

---

## 8. Our constraints (for context)

- Strict policy: **no local password storage or fallback** for SORT. If EnrollPro auth is unreachable, SORT logins fail closed with an explicit "authentication service unreachable" message. This is by design (owner decision) — so learner auth *must* work over the API for students to use SORT at all.
- We match accounts by `enrollproLrn`, `employeeId`, or `email`; staff log in with Employee ID, learners with LRN (= `portalAccount.accountName`).
- SORT is a DepEd-school deployment; the learner cohort is the primary user base (81 learners vs 43 staff currently).

---

## 9. Appendix — raw probe outputs (2026-09-07)

```
POST /auth/login {accountName:"1234501",password:"DepEdSY2026!"}   -> 200 {"token":"eyJ..."}   (JWT payload: userId=133, roles=["SYSTEM_ADMIN"], mustChangePassword=false, exp=iat+86400)
POST /auth/login {accountName:"202700000004",password:"DepEd2026!"} -> 401 {"message":"Invalid employee ID or password"}
POST /auth/login {accountName:"202900000004",password:"DepEd2026!"} -> 401 {"message":"Invalid employee ID or password"}
POST /auth/login {accountName:"202700000004",password:"DepEd2026!"} with field names lrn/identifier/email/username -> 400 {"message":"Validation failed","errors":{"accountName":["Invalid input: expected string, received undefined"]}}
POST /auth/login {accountName:"",password:"x"}                      -> 400 {"message":"Validation failed","errors":{"accountName":["Employee ID is required"]}}
GET  /auth/learner-login | /auth/student-login | /learners/login | /portal/auth/login | /integration/v1/learners/login -> 404 {"code":"NOT_FOUND","message":"API endpoint not found: GET /api/..."}
GET  /openapi.json | /swagger.json | /docs | /api-docs | /v1 | /integration/v1 -> 404 (no discovery surface)
GET  /integration/v1/school-year (X-Integration-Key)                -> 200 {"data":{"id":8,"yearLabel":"2029-2030","term1Start":"2029-06-08",...}}
GET  /integration/v1/learners?page=1&limit=200 (X-Integration-Key, x-school-year-context-id:8) -> 200, 81 records; learner.portalAccount present for 80/81
```

SORT server-side logs (delegated login attempts):

```
[Auth] Login failed: invalid credentials for "202900000007"   (password rejected by EnrollPro)
[Auth] Login failed: invalid credentials for "202900000004"   (password rejected by EnrollPro)
[Auth] Login failed: invalid credentials for "202700000004"   (password rejected by EnrollPro)
[Auth] Login failed: invalid credentials for "202900000006"   (password rejected by EnrollPro)
[Auth] Login failed: student "117463100000" has no active EnrollPro portal account   (handled: no portalAccount in directory)
```
