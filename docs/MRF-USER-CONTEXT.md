# MRF User Context

## What is an MRF User?

The `MRF` role represents **Materials Recovery Facility staff** — the on-the-ground personnel who physically collect, weigh, and process campus waste. They operate their own isolated sign-in path (`/mrf/signin`) and dashboard (`/mrf`), separate from the student/teacher/admin interfaces.

---

## Seed / Demo Account

| Field     | Value                       |
|-----------|-----------------------------|
| Username  | `ricomendoza`               |
| Password  | `rico123`                   |
| Full name | Rico Mendoza                |
| Email     | rico.mendoza@school.edu     |
| Role      | `MRF`                       |
| Provider  | `LOCAL`                     |
| Points    | 0 (MRF staff do not earn points) |

> MRF may retain local operational credentials, but it now consumes EnrollPro's keyed identity feed for learner and personnel reconciliation. Password hashes are never synchronized.

---

## Database Fields (relevant to MRF)

```
User {
  id                  Int
  username            String   (unique)
  password            String   (bcrypt-hashed)
  role                Role     = MRF
  firstName           String?
  lastName            String?
  email               String?
  provider            String   = "LOCAL"
  isActive            Boolean  = true

  // Not applicable for MRF:
  lrn                 null     (student-only)
  yearLevel           null
  section             null
  enrollproEmployeeId null
  points              0        (never incremented)
  quarterlyPoints     0
  lifetimePoints      0
  eligibleForCertificate false
}
```

---

## What MRF Staff Can Do

### Dashboard Tabs

| Tab         | Function                                                          |
|-------------|-------------------------------------------------------------------|
| **Tasks**   | View reports assigned to them (DISPATCHED / IN_PROGRESS)          |
| **Quick Log** | Create a direct COMPLETED report (bypasses PENDING flow)        |
| **History** | Full history of their completed collections — no retention filter |
| **Analytics** | Stats: pending count, collecting count, done count, total kg   |

### Permissions

| Action                          | MRF | ADMIN | STUDENT | TEACHER |
|---------------------------------|-----|-------|---------|---------|
| View all reports                | ✅  | ✅    | ❌      | ❌      |
| Create report (direct COMPLETED)| ✅  | ✅    | ❌      | ❌      |
| Set `kilosCollected`            | ✅  | ✅    | ❌      | ❌      |
| Set `assetAction`               | ✅  | ✅    | ❌      | ❌      |
| Update report status            | ✅  | ✅    | ❌      | ❌      |
| Bypass retention filters        | ✅  | ❌    | —       | —       |
| Dispatch staff                  | ❌  | ✅    | ❌      | ❌      |
| Earn points on reports          | ❌  | ❌    | ✅      | ❌      |

> Admin sees reports with a 14-day completed/resolved retention filter and a 5-minute dismissed filter. MRF bypasses both and sees full history.

---

## Report Lifecycle (MRF's Role)

```
Student/Teacher submits
        ↓
   PENDING
        ↓  Admin verifies (VERIFIED — points awarded to reporter)
   VERIFIED
        ↓  Admin dispatches → assigns MRF staff (assignedStaffId)
   DISPATCHED          ← MRF sees this in Tasks tab
        ↓  MRF enters kilos/assetAction → confirms pickup
   IN_PROGRESS
        ↓  MRF finalizes
   COMPLETED           ← MRF sees this in History tab
```

### Quick Log (MRF shortcut)
MRF staff can skip the PENDING/DISPATCHED steps entirely by using the **Quick Log** tab. This directly creates a `COMPLETED` report with `assignedStaffId` set to the staff member's own ID. Useful for ad-hoc collections not initiated by a student report.

---

## Realtime Behavior

The MRF dashboard subscribes to three SSE events:
- `report.created` — refreshes Tasks and History
- `report.updated` — refreshes Tasks and History
- `report.deleted` — refreshes Tasks and History

Polling fallback: every **30 seconds** if SSE is unavailable.

---

## API Endpoints MRF Uses

| Method | Path                        | Purpose                              |
|--------|-----------------------------|--------------------------------------|
| POST   | `/api/auth/signin`          | Sign in (MRF-only route checks role) |
| GET    | `/api/reports`              | Fetch all reports (full history)     |
| POST   | `/api/reports`              | Create Quick Log (direct COMPLETED)  |
| PATCH  | `/api/reports/:id/status`   | Mark IN_PROGRESS or COMPLETED        |
| POST   | `/api/reports/:id/collect`  | Confirm collection + enter kilos     |
| GET    | EnrollPro `/api/integration/v1/default/mrf/identities` | Pull school-year-scoped learner, teacher, staff, and MRF-role identity context using `X-Integration-Key` |

---

## Key Constraints

- **No points** — MRF staff submitting reports via Quick Log do not earn gamification points (only students do).
- **No password sync** — MRF can reconcile identities from EnrollPro, but credentials and password hashes remain owned by the authenticating system.
- **No password reset flow** — currently no self-service reset; admin must update directly in DB or via admin panel.
- **assignedStaffId** — set on a report when dispatched by admin OR auto-set to the staff member's own ID on Quick Log COMPLETED entries.
- **Bin status auto-update** — any report creation or status change by MRF triggers a bin fill recalculation for that location.
