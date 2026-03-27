# Application Status Lifecycle
## Early Registration · Regular Enrollment · SCP Admission

**Document Version:** 1.0.0
**System:** School Admission, Enrollment & Information Management System
**Module:** Enrollment Management — Applications (`/applications/admission` · `/applications/enrollment`)
**Policy Basis:** DepEd Order No. 017, s. 2025 · DepEd Order No. 03, s. 2018 · DM 149, s. 2011
**Prisma Enum:** `ApplicationStatus`

---

## Table of Contents

1. [Overview — The Two-Phase DepEd Structure](#1-overview--the-two-phase-deped-structure)
2. [The Two Admission Paths](#2-the-two-admission-paths)
3. [All Status Values — Definition Reference](#3-all-status-values--definition-reference)
4. [Path A — Regular Admission Status Flow](#4-path-a--regular-admission-status-flow)
   - 4.1 [PENDING](#41-pending)
   - 4.2 [APPROVED](#42-approved)
   - 4.3 [ENROLLED](#43-enrolled)
   - 4.4 [REJECTED](#44-rejected)
5. [Path B — SCP Admission Status Flow](#5-path-b--scp-admission-status-flow)
   - 5.1 [PENDING (SCP)](#51-pending-scp)
   - 5.2 [EXAM_SCHEDULED](#52-exam_scheduled)
   - 5.3 [EXAM_TAKEN](#53-exam_taken)
   - 5.4 [PASSED](#54-passed)
   - 5.5 [FAILED](#55-failed)
   - 5.6 [APPROVED (SCP)](#56-approved-scp)
   - 5.7 [ENROLLED (SCP)](#57-enrolled-scp)
   - 5.8 [REJECTED (SCP)](#58-rejected-scp)
6. [SCP Program × Status Flow Matrix](#6-scp-program--status-flow-matrix)
7. [Status × UI — Action Buttons Per Status](#7-status--ui--action-buttons-per-status)
8. [Status × Sidebar — Which View Shows What](#8-status--sidebar--which-view-shows-what)
9. [Status × Email Notifications](#9-status--email-notifications)
10. [Status × Audit Log Entries](#10-status--audit-log-entries)
11. [Status Badge Visual Reference](#11-status-badge-visual-reference)
12. [Valid Status Transitions — Full Table](#12-valid-status-transitions--full-table)
13. [Prisma & API Implementation](#13-prisma--api-implementation)
14. [Phase 2 — What Happens to APPROVED Applicants in June](#14-phase-2--what-happens-to-approved-applicants-in-june)
15. [Edge Cases & Policy Rules](#15-edge-cases--policy-rules)

---

## 1. Overview — The Two-Phase DepEd Structure

DepEd Order No. 017, s. 2025 divides enrollment into two legally distinct phases. Understanding these phases is essential to understanding why the status system is designed the way it is.

```
JANUARY                    FEBRUARY         MARCH–MAY     JUNE
────────────────────────────────────────────────────────────────────
[─── PHASE 1: EARLY REGISTRATION ──────────────]           [PHASE 2]
    Last Saturday of January → Last Friday of February    ~1 week before
    Grade 7 · Grade 11 · All Transferees · Balik-Aral     class opening
    → Outcome: APPROVED (pre-registration only)            → ENROLLED
                                                           (official)
```

| Phase | DepEd Term | System Outcome | Legal Weight |
|---|---|---|---|
| Phase 1 | Early Registration | `APPROVED` | Pre-registration — a reserved slot, not yet official |
| Phase 2 | Regular Enrollment | `ENROLLED` | Official enrollment of record — learner is now a student |

**`APPROVED` ≠ `ENROLLED`.** This distinction drives the entire status system. An `APPROVED` applicant has been accepted and assigned a section. An `ENROLLED` applicant has completed Phase 2 document verification and is officially registered in the school's records.

---

## 2. The Two Admission Paths

Every applicant during Early Registration follows exactly one of two paths:

| | Path A — Regular Admission | Path B — SCP Admission |
|---|---|---|
| **Who** | Grade 7 (non-SCP) · Grade 11 (non-STEM) · Most transferees · Balik-Aral | STE · SPA · SPS · SPJ · SPFL · SPTVE · Grade 11 STEM |
| **Key step** | Registrar verifies documents → approves immediately | Registrar verifies documents → schedules entrance exam/audition → records result → pass/fail decision |
| **Statuses used** | `PENDING` → `APPROVED` → `ENROLLED` (or `REJECTED`) | `PENDING` → `EXAM_SCHEDULED` → `EXAM_TAKEN` → `PASSED`/`FAILED` → `APPROVED` → `ENROLLED` (or `REJECTED`) |
| **Timeline** | Resolved in one visit (F2F) or within days (online) | Can span weeks — exam date set by SDO or school |

---

## 3. All Status Values — Definition Reference

These are the exact values stored in `Applicant.status` (Prisma `ApplicationStatus` enum).

| Status | Path | Phase | Who Can Set It | Description |
|---|---|---|---|---|
| `PENDING` | Both | Phase 1 | System (on submission) | Application submitted. Awaiting registrar action. |
| `EXAM_SCHEDULED` | SCP only | Phase 1 | Registrar | Assessment date confirmed. Awaiting exam day. |
| `EXAM_TAKEN` | SCP only | Phase 1 | Registrar | Assessment result recorded. Pass/fail decision pending. |
| `PASSED` | SCP only | Phase 1 | Registrar | Met qualifying standards. Section not yet assigned. |
| `FAILED` | SCP only | Phase 1 | Registrar | Did not meet qualifying standards. |
| `APPROVED` | Both | Phase 1 → Phase 2 | Registrar | Accepted + section assigned. Pre-registration complete. |
| `ENROLLED` | Both | Phase 2 | Registrar | Official enrollment of record. Phase 2 confirmed. |
| `REJECTED` | Both | Phase 1 | Registrar | Not accepted. Parent notified. May resubmit. |

---

## 4. Path A — Regular Admission Status Flow

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │  APPLICANT SUBMITS BEEF                                             │
 │  (Online: POST /api/applications)                                   │
 │  (F2F:   POST /api/applications/f2f)                                │
 └──────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
                          ● PENDING
                                │
                   ┌────────────┴────────────┐
                   │                         │
                   ▼                         ▼
             ✓ APPROVED                ✗ REJECTED
             + section assigned        + rejection reason
                   │                         │
                   │                    (parent may
                   │                     resubmit)
                   │ (Phase 2 — June)
                   ▼
             ✓ ENROLLED
             (official enrollment
              of record)
```

---

### 4.1 PENDING

```
Status    : PENDING
Path      : Regular (Path A)
Set by    : System — automatically on form submission
Phase     : Phase 1
```

**What it means:**
The applicant has successfully submitted the BEEF — either through the online portal (`/apply`) or entered by the registrar via walk-in (`/f2f-admission`). The application is in the registrar's inbox, waiting to be reviewed.

No decision has been made. No section has been assigned. The learner is not yet pre-registered.

**What happens on the system side:**
- `Applicant` record created in the database
- `trackingNumber` auto-generated (format: `APP-YYYY-NNNNN`)
- `AuditLog: APPLICATION_SUBMITTED` (online) or `F2F_APPLICATION_ENTERED` (walk-in)
- Email sent to the parent/guardian if `emailAddress` was provided
- Application appears in the registrar's **Applications → Admission** inbox

**What the registrar sees:**
```
ADMISSION APPLICANTS

  #   │ Learner Name       │ LRN          │ Grade   │ Type    │ Status    │ Actions
  ────┼────────────────────┼──────────────┼─────────┼─────────┼───────────┼────────
  055 │ Dela Cruz, Juan R. │ 123456789012 │ Grade 7 │ REGULAR │ ● PENDING │ [View]
```

**Action available to registrar:** `Approve & Assign Section` · `Reject Application`

**DepEd policy note:** The registrar should process PENDING applications promptly during Phase 1. Leaving a learner in PENDING status too long means they have no reserved slot — the school cannot guarantee a section for them if capacity fills up while the application sits unreviewed.

---

### 4.2 APPROVED

```
Status    : APPROVED
Path      : Regular (Path A)
Set by    : Registrar — via "Approve & Assign Section" action
Phase     : Phase 1 complete · Awaiting Phase 2 confirmation
```

**What it means:**
The registrar has verified the applicant's documents and approved the application. A section has been assigned. An `Enrollment` record has been created in the database.

**`APPROVED` is a Phase 1 outcome — it means pre-registration, not official enrollment.** The learner has a reserved slot in a specific section, but they are not yet officially a student of the school for this school year. Official enrollment happens in Phase 2 (June).

**What happens on the system side:**
- `Applicant.status` → `APPROVED`
- `Enrollment` record created: `{ applicantId, sectionId, academicYearId, enrolledById }`
- Section's enrolled count incremented
- The section slot is now reserved and locked — it cannot be double-assigned
- `AuditLog: APPLICATION_APPROVED — "Registrar approved #055 → Grade 7 Rizal"`
- Confirmation email sent to parent (if email provided): *"Your Enrollment is Confirmed"*

**Transaction safety:**
The section assignment uses a PostgreSQL `FOR UPDATE` row-level lock inside a `Prisma.$transaction()` to prevent two registrars from simultaneously assigning the last available slot in the same section.

```sql
BEGIN;
  SELECT id, "maxCapacity" FROM "Section"
  WHERE id = $sectionId FOR UPDATE;    ← row locked
  COUNT(*) FROM "Enrollment" WHERE "sectionId" = $sectionId;
  -- if count < maxCapacity: proceed
  INSERT INTO "Enrollment" ...;
  UPDATE "Applicant" SET status = 'APPROVED' WHERE id = $id;
COMMIT;
```

**What the registrar sees:**
The application moves from the **Admission** view to the **Enrollment** view. In the Admission view, it disappears from the default filter. In the Enrollment view:

```
ENROLLED / APPROVED

  LRN            │ Full Name          │ Grade   │ Section │ Status     │ Actions
  ───────────────┼────────────────────┼─────────┼─────────┼────────────┼────────
  123456789012   │ Dela Cruz, Juan R. │ Grade 7 │ Rizal   │ ◎ APPROVED │ [View]
```

**What the parent receives (email):**
```
Subject: Your Enrollment is Confirmed — [School Name], SY 2026–2027

Learner     : DELA CRUZ, Juan Reyes
Grade Level : Grade 7
Section     : Grade 7 – Rizal
Tracking #  : APP-2026-00055

Please report to school during the enrollment period (1 week before
June class opening) for final document verification.
```

**Actions available to registrar:** View · Edit record (if data corrections needed)

---

### 4.3 ENROLLED

```
Status    : ENROLLED
Path      : Regular (Path A)
Set by    : Registrar — Phase 2 confirmation in June
Phase     : Phase 2 complete
```

**What it means:**
The learner has completed Phase 2. The parent/guardian returned to school during Brigada Eskwela week with the complete physical documents (PSA Birth Certificate, Grade 6 SF9, etc.). The registrar confirmed the documents, and the learner is now **officially enrolled** — an enrollment of record in this school for this school year.

This is the terminal status for a successfully enrolled learner. `ENROLLED` records persist permanently in SIMS across all academic years as part of the learner's academic history.

**What happens on the system side:**
- If all data was correctly captured in Phase 1: no new API call needed — the Enrollment record already exists
- If a data correction is needed: `PUT /api/students/:id` edits the applicant record → `AuditLog: STUDENT_RECORD_UPDATED`
- The learner is now findable in the SIMS student directory (`/students`)
- At the end of the school year, the record is archived (read-only) when the next AY is activated

**DepEd policy note:** `ENROLLED` is the status that the registrar encodes in DepEd LIS (Learner Information System) as the official enrollment of record. The school submits LIS data to the SDO based on `ENROLLED` counts — not `APPROVED` counts.

---

### 4.4 REJECTED

```
Status    : REJECTED
Path      : Both (Regular and SCP)
Set by    : Registrar — via "Reject Application" action
Phase     : Phase 1
```

**What it means:**
The registrar has determined the application cannot be processed due to a verifiable data integrity problem. Common legitimate reasons:

| Reason | Example |
|---|---|
| Duplicate LRN | The same 12-digit LRN is already registered to a different learner |
| Fictitious information | Name does not match PSA Birth Certificate |
| Already enrolled | LRN is already enrolled in this school for the active AY |
| SCP failure (declined alternative) | SCP applicant failed the exam and declined a regular section placement |

**When rejection is NOT appropriate (DO 017, s. 2025):**

| ❌ NEVER reject for this reason | ✅ Correct action instead |
|---|---|
| Missing PSA Birth Certificate | Enroll provisionally; parent submits by October 31 |
| Missing SF9 / Grade 6 report card | Accept school certification letter; proceed |
| Learner has a disability | Enroll immediately; coordinate with SPED |
| Unpaid fees at previous school | Enroll; assist with Affidavit of Undertaking |
| No good moral certificate | Never required in public schools |

**What happens on the system side:**
- `Applicant.status` → `REJECTED`
- `Applicant.rejectionReason` → saved (the reason the registrar typed)
- No `Enrollment` record created — no section slot reserved
- `AuditLog: APPLICATION_REJECTED — "Registrar Cruz rejected #055. Reason: [text]"`
- Rejection email sent to parent: *"Update on Your Application to [School Name]"* — includes the reason and instructions to resubmit

**Can a rejected applicant resubmit?**
Yes. The parent may submit a new BEEF through `/apply` (if gate is open) or ask the registrar to enter a new walk-in application via `/f2f-admission`. The new submission creates a completely separate `Applicant` record with a new tracking number. The rejected record remains in the database permanently (audit trail) but has no further effect.

---

## 5. Path B — SCP Admission Status Flow

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │  APPLICANT SUBMITS BEEF + declares SCP program                      │
 └──────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
                          ● PENDING
                          (docs unverified)
                                │
                   ┌────────────┴────────────┐
                   │                         │
                   ▼                         ▼
           ⏳ EXAM_SCHEDULED            ✗ REJECTED
           (docs verified;              (data integrity problem
            exam date set)               at initial review)
                   │
                   ▼
           📋 EXAM_TAKEN
           (result recorded;
            decision pending)
                   │
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
    ✅ PASSED          ❌ FAILED
    (met cut-off)      (did not qualify)
          │                 │
          │          ┌──────┴──────┐
          │          │             │
          │          ▼             ▼
          │    ✓ APPROVED      ✗ REJECTED
          │    (offered         (declined
          │     regular          regular
          │     section)         section)
          │
          ▼
    ✓ APPROVED
    (SCP section assigned)
          │
          │ (Phase 2 — June)
          ▼
    ✓ ENROLLED
```

---

### 5.1 PENDING (SCP)

```
Status    : PENDING
Path      : SCP (Path B)
Set by    : System — automatically on form submission
Phase     : Phase 1 — pre-document verification
```

Identical to Path A PENDING in terms of system behavior. The key difference is what the registrar sees in the detail view.

For SCP applicants in PENDING status, the detail view shows:
```
APPLICATION DETAIL  #APP-2026-00053
Channel: Online                                   Status: ● PENDING
─────────────────────────────────────────────────────────────────────
ENROLLMENT PREFERENCE
  Grade Level : Grade 7
  Application : ⚡ SPECIAL CURRICULAR PROGRAM
  SCP Type    : Science, Technology & Engineering (STE)

SCP ASSESSMENT STATUS
  Exam Date   : Not yet scheduled
  Exam Score  : —
  Result      : —
─────────────────────────────────────────────────────────────────────
[ ✓ Verify & Schedule Exam ]     [ ✗ Reject Application ]
```

The action button is **"Verify & Schedule Exam"** — NOT "Approve & Assign Section". The registrar verifies physical documents and then proceeds to scheduling. Section assignment only happens after the applicant passes the assessment.

---

### 5.2 EXAM_SCHEDULED

```
Status    : EXAM_SCHEDULED
Path      : SCP (Path B)
Set by    : Registrar — via "Verify & Schedule Exam" action
Phase     : Phase 1 — between document verification and assessment day
API       : PATCH /api/applications/:id/schedule-exam
```

**What it means:**
The registrar has verified the applicant's documents and confirmed the exam date. The applicant has been formally cleared to take the assessment. They are waiting for the assessment day to arrive.

The assessment date is typically set by the Schools Division Office (SDO) for programs like STE. The registrar enters the SDO-announced date into the system.

**What is stored on the `Applicant` record:**
- `status` → `EXAM_SCHEDULED`
- `examDate` → the assessment date (`DateTime`)
- `assessmentType` → auto-set from `ScpProgram.assessmentType` (e.g., `EXAM_ONLY`, `EXAM_AUDITION`)

**What the registrar sees:**
```
  053 │ Reyes, Pedro M. │ 112233445566 │ Grade 7 │ STE │ ⏳ EXAM_SCHEDULED │ [View]
```

**Application detail view:**
```
SCP ASSESSMENT STATUS
  Exam Date   : February 22, 2027 (Saturday)
  Assessment  : Written Entrance Exam (STE)
  Venue       : [School Building] — Room 201
  Exam Score  : —
  Result      : —
─────────────────────────────────────────────────────────────────────
[ 📝 Record Assessment Result ]
```

**Email sent to parent:**
```
Subject: Your STE Entrance Exam — [School Name]

Dear Ms. Reyes,

Pedro Manuel Reyes is scheduled to take the STE Entrance Exam.

Date  : February 22, 2027 (Saturday)
Venue : [School Building] — Room 201

Please arrive 30 minutes before the exam.
Bring: 2 valid IDs (school ID or PSA BC), pencils, ballpen.
Tracking # : APP-2027-00053
```

**`AuditLog:`** `EXAM_SCHEDULED — "Registrar Cruz scheduled WRITTEN_EXAM for Pedro Reyes on Feb 22, 2027"`

---

### 5.3 EXAM_TAKEN

```
Status    : EXAM_TAKEN
Path      : SCP (Path B)
Set by    : Registrar — via "Record Assessment Result" action
Phase     : Phase 1 — result in, decision pending
API       : PATCH /api/applications/:id/record-result
```

**What it means:**
The assessment day has passed. The registrar has entered the result (score, audition result, interview result — depending on the SCP's `assessmentType`). The formal pass/fail decision has not been applied yet. This status acts as a buffer between receiving the result and making the official determination.

**Why this intermediate status exists:**
For some SCPs (SPJ, STEM G11), the registrar records the exam score first, then schedules and records a separate interview. `EXAM_TAKEN` holds the applicant in a "result recorded but not yet decided" state while this multi-step process completes.

**What is stored on the `Applicant` record:**
- `status` → `EXAM_TAKEN`
- `examScore` → numeric score (if applicable)
- `examResult` → `PASSED` or `FAILED` (the raw result of the exam component only)
- `auditionResult` → `CLEARED` or `NOT_CLEARED` (SPA/SPS only)
- `interviewResult` → `CLEARED` or `NOT_CLEARED` (SPJ, STEM G11 if applicable)
- `examNotes` → optional registrar notes

**Application detail view:**
```
SCP ASSESSMENT STATUS
  Exam Date   : February 22, 2027
  Exam Score  : 87.5 / 100
  Result      : PASSED (score meets cut-off of 75.0)
  Notes       : Top 15% of division examinees
─────────────────────────────────────────────────────────────────────
[ ✅ Mark as Passed & Assign Section ]   [ ❌ Mark as Failed ]
```

**`AuditLog:`** `EXAM_RESULT_RECORDED — "Registrar Cruz recorded STE result for Pedro Reyes: PASSED (87.5)"`

---

### 5.4 PASSED

```
Status    : PASSED
Path      : SCP (Path B)
Set by    : Registrar — via "Mark as Passed" action
Phase     : Phase 1 — cleared for section assignment
API       : PATCH /api/applications/:id/pass  { sectionId }
```

**What it means:**
The applicant has formally passed all required assessment components for their SCP. The registrar marks them as PASSED and immediately assigns them to the appropriate SCP section. When the section is assigned, the status transitions from `PASSED` to `APPROVED` in the same transaction.

In practice, `PASSED` is a very brief transitional state — the system moves through it to `APPROVED` within the same API call. It is preserved as a distinct status for:
- Audit trail clarity (the `PASSED` decision is logged separately from the section assignment)
- Edge cases where a section assignment needs to be retried

**What happens when "Mark as Passed & Assign Section" is clicked:**
1. Section assignment dialog opens
2. Registrar selects the SCP-designated section
3. On confirm: `PATCH /api/applications/:id/pass { sectionId: [STE-A ID] }`
4. Server: enrollment transaction with `FOR UPDATE` lock
5. `Applicant.status` → `PASSED` → then immediately `APPROVED` (within the same transaction)
6. `Enrollment` record created
7. `AuditLog: APPLICATION_PASSED — "Registrar Cruz: Pedro Reyes PASSED STE, assigned to Grade 7 STE-A"`
8. Email sent: *"Congratulations! You Passed the STE Assessment"*

---

### 5.5 FAILED

```
Status    : FAILED
Path      : SCP (Path B)
Set by    : Registrar — via "Mark as Failed" action
Phase     : Phase 1 — did not qualify
API       : PATCH /api/applications/:id/fail
```

**What it means:**
The applicant did not meet the qualifying standards for the SCP program. The registrar has two options at this point — and the system enforces that neither option involves turning the learner away from basic education.

**Two options available to the registrar:**

**Option 1 — Offer a Regular Section:**
The registrar switches the applicant to the regular program and assigns them to a non-SCP section. The applicant's `applicantType` changes from the SCP code to `REGULAR`. A section assignment dialog opens showing all non-SCP sections for the grade level.

Result: `FAILED` → `APPROVED` (regular section)

**Option 2 — Reject:**
Only used when the parent explicitly declines a regular section placement (e.g., the family will transfer to a school that offers the SCP program). The registrar clicks `Reject` and types the reason.

Result: `FAILED` → `REJECTED`

**DepEd policy basis:**
DO 017, s. 2025 states that *"no learner may be turned away from basic education due to performance on an optional assessment."* A failed SCP exam is never grounds for refusing enrollment entirely — the school must always offer the regular program as an alternative.

**What the registrar sees:**
```
RECORD FAILURE — Lim, Rosa (STE)

  Exam Score  : 62.0 / 100
  Cut-off     : 75.0
  Result      : Did not meet cut-off

  What would you like to do?
  ●  Offer a Regular Section
     (Switch applicant to regular program; assign to a regular Grade 7 section)
  ○  Reject Application
     (If parent declines regular section; applicant will enroll elsewhere)

           [ Cancel ]           [ Confirm ]
```

**`AuditLog:`** `APPLICATION_FAILED — "Registrar Cruz marked Rosa Lim as FAILED. Notes: Score 62.0, cut-off 75.0"`

---

### 5.6 APPROVED (SCP)

```
Status    : APPROVED
Path      : SCP (Path B) — after PASSED or FAILED-with-regular-offer
Set by    : Registrar — as part of pass action or failed-to-regular offer
Phase     : Phase 1 complete · Awaiting Phase 2 confirmation
```

Functionally identical to Path A `APPROVED`. The learner has been accepted (either in their SCP section after passing, or in a regular section after failing and accepting the alternative). An `Enrollment` record exists. Section slot is reserved.

For SCP PASSED applicants, the confirmation email includes the SCP program name:
```
Subject: Congratulations! Pedro Passed the STE Assessment — [School Name]

Program     : Science, Technology & Engineering (STE)
Grade Level : Grade 7
Section     : Grade 7 – STE-A
Tracking #  : APP-2026-00053
```

---

### 5.7 ENROLLED (SCP)

Identical to Path A `ENROLLED`. Phase 2 completion in June. Official enrollment of record.

---

### 5.8 REJECTED (SCP)

Identical to Path A `REJECTED` in terms of system behavior. Can occur at two points in the SCP path:

1. **During initial PENDING review** — if the registrar finds a data integrity problem before even scheduling the exam (e.g., the LRN belongs to a different learner)
2. **After FAILED** — if the parent explicitly declines the regular section alternative

---

## 6. SCP Program × Status Flow Matrix

Different SCP programs use different assessment types, which determines which statuses are visited and what results are recorded.

| SCP | Assessment Type | `EXAM_SCHEDULED` | `EXAM_TAKEN` | Fields Recorded |
|---|---|---|---|---|
| **STE** | `EXAM_ONLY` | ✅ Exam date | ✅ Exam score | `examScore` · `examResult` |
| **SPA** | `EXAM_AUDITION` | ✅ Combined date (exam + audition same day) | ✅ Both results | `examScore` · `auditionResult` · `interviewResult` |
| **SPS** | `AUDITION_ONLY` | ✅ Tryout date | ✅ Tryout result | `auditionResult` |
| **SPJ** | `EXAM_ONLY` + interview | ✅ Exam date | ✅ Exam + interview | `examScore` · `interviewDate` · `interviewResult` |
| **SPFL** | `NAT_REVIEW` | ❌ No exam scheduled | ✅ NAT score entered | `natScore` |
| **SPTVE** | `APTITUDE` | ✅ Aptitude test date | ✅ Aptitude result | `examScore` · `examResult` |
| **STEM G11** | `EXAM_ONLY` + interview | ✅ Exam date | ✅ Exam + interview | `grade10ScienceGrade` · `grade10MathGrade` · `examScore` · `interviewResult` |

> **Note on SPFL:** Because SPFL uses existing NAT (National Achievement Test) scores from elementary, no separate exam is scheduled. The registrar enters the NAT English score directly. The status jumps from `PENDING` to `EXAM_TAKEN` (result recorded) without passing through `EXAM_SCHEDULED`.

---

## 7. Status × UI — Action Buttons Per Status

The system renders **only the buttons applicable to the current status and applicant type**. A registrar processing 50 applications in one session never sees irrelevant options.

| `applicantType` | `status` | Button 1 | Button 2 | Button 3 |
|---|---|---|---|---|
| `REGULAR` | `PENDING` | ✅ Approve & Assign Section | ❌ Reject | — |
| Any SCP | `PENDING` | ✅ Verify & Schedule Exam | ❌ Reject | — |
| Any SCP | `EXAM_SCHEDULED` | 📝 Record Assessment Result | — | — |
| Any SCP | `EXAM_TAKEN` | ✅ Mark as Passed | ❌ Mark as Failed | — |
| Any SCP | `PASSED` | ✅ Assign Section | — | — |
| Any SCP | `FAILED` | 🔄 Offer Regular Section | ❌ Reject | — |
| Both | `APPROVED` | 👁 View | ✏️ Edit Record | — |
| Both | `ENROLLED` | 👁 View | ✏️ Edit Record | — |
| Both | `REJECTED` | 👁 View | — | — |

**Frontend rendering logic:**

```tsx
// client/src/components/applications/ActionButtons.tsx
const isRegular = applicant.applicantType === 'REGULAR';
const isSCP     = !isRegular;

{isRegular && applicant.status === 'PENDING' && (
  <>
    <Button onClick={handleApprove}>Approve & Assign Section</Button>
    <Button variant="destructive" onClick={handleReject}>Reject</Button>
  </>
)}

{isSCP && applicant.status === 'PENDING' && (
  <>
    <Button onClick={handleScheduleExam}>Verify & Schedule Exam</Button>
    <Button variant="destructive" onClick={handleReject}>Reject</Button>
  </>
)}

{isSCP && applicant.status === 'EXAM_SCHEDULED' && (
  <Button onClick={handleRecordResult}>Record Assessment Result</Button>
)}

{isSCP && applicant.status === 'EXAM_TAKEN' && (
  <>
    <Button onClick={handlePass}>Mark as Passed</Button>
    <Button variant="destructive" onClick={handleFail}>Mark as Failed</Button>
  </>
)}

{isSCP && applicant.status === 'PASSED' && (
  <Button onClick={handleAssignSection}>Assign Section</Button>
)}

{isSCP && applicant.status === 'FAILED' && (
  <>
    <Button onClick={handleOfferRegular}>Offer Regular Section</Button>
    <Button variant="destructive" onClick={handleReject}>Reject</Button>
  </>
)}
```

---

## 8. Status × Sidebar — Which View Shows What

The Applications nav item is split into two subnav views. Each view filters by a specific set of statuses.

### Applications → Admission (`/applications/admission`)

Shows applications where the registrar still has active work to do — decisions to make, results to record, or exams to schedule.

| Status shown | Why it belongs here |
|---|---|
| `PENDING` | Registrar needs to review and act |
| `EXAM_SCHEDULED` | Registrar waiting for assessment day; may need to update date |
| `EXAM_TAKEN` | Registrar needs to formally pass or fail |
| `PASSED` | Registrar needs to assign section |
| `FAILED` | Registrar needs to offer regular section or reject |

```
ADMISSION APPLICANTS    [ Search... 🔍 ]   [Filter ▾]

  Year: SY 2026–2027   Grade: All ▾   Type: All ▾   Status: All ▾

  #   │ Name               │ Grade   │ Type    │ Status         │ Actions
  ────┼────────────────────┼─────────┼─────────┼────────────────┼────────
  055 │ Dela Cruz, Juan R. │ Grade 7 │ REGULAR │ ● PENDING      │ [View]
  053 │ Reyes, Pedro M.    │ Grade 7 │ STE     │ ⏳ EXAM_SCHED  │ [View]
  052 │ Garcia, Ana B.     │ Grade 7 │ SPA     │ 📋 EXAM_TAKEN  │ [View]
  051 │ Torres, Carlo M.   │ Grade 7 │ STE     │ ✅ PASSED      │ [View]
  050 │ Lim, Rosa A.       │ Grade 7 │ STE     │ ❌ FAILED      │ [View]
```

**Sidebar badge on "Admission" label:** Shows count of `PENDING` applications as a pill — e.g., `Admission (14)`.

### Applications → Enrollment (`/applications/enrollment`)

Shows applications where the decision is made and the learner is either pre-registered or officially enrolled. Registrar's role here is Phase 2 confirmation and data corrections.

| Status shown | Why it belongs here |
|---|---|
| `APPROVED` | Pre-registered — waiting for Phase 2 (June) confirmation |
| `ENROLLED` | Officially enrolled — Phase 2 complete |

```
ENROLLED / APPROVED    [ Search... 🔍 ]   [Filter ▾]

  Year: SY 2026–2027   Grade: All ▾   Section: All ▾   Status: All ▾

  LRN            │ Full Name          │ Grade   │ Section │ Status     │ Actions
  ───────────────┼────────────────────┼─────────┼─────────┼────────────┼────────
  123456789012   │ Dela Cruz, Juan R. │ Grade 7 │ Rizal   │ ✓ ENROLLED │ [View]
  876543219012   │ Santos, Maria L.   │ Grade 11│ STEM-A  │ ✓ ENROLLED │ [View]
  998877665544   │ Garcia, Pedro T.   │ Grade 9 │ Luna    │ ◎ APPROVED │ [View]
```

**`REJECTED` status** does not appear in either active view by default. Registrars can filter for it using the Status dropdown to review rejected applications for audit purposes.

---

## 9. Status × Email Notifications

Every status transition that affects the parent/guardian triggers an email notification — sent asynchronously via `setImmediate()` after the HTTP response.

| Status Transition | Email Template | Subject |
|---|---|---|
| → `PENDING` (online) | `ApplicationReceived` | `Application Received — #[tracking] · [schoolName]` |
| → `PENDING` (F2F) | `F2FApplicationRecorded` | `Your Walk-in Application Has Been Recorded — #[tracking] · [schoolName]` |
| → `EXAM_SCHEDULED` | `ExamScheduled` | `Your [programName] Assessment Date — [schoolName]` |
| → `APPROVED` (regular) | `EnrollmentConfirmed` | `Your Enrollment is Confirmed — [schoolName], SY [yearLabel]` |
| → `APPROVED` (SCP passed) | `ExamPassed` | `Congratulations! You Passed the [programName] Assessment — [schoolName]` |
| → `REJECTED` | `ApplicationRejected` | `Update on Your Application to [schoolName]` |
| → `FAILED` | `ExamFailed` | `Update on Your [programName] Application — [schoolName]` |

**Email rule:** Email is only sent if `Applicant.emailAddress` is not null. For F2F applications where the parent has no email, no notification is sent — the registrar writes down the tracking number for the parent.

All email subjects use `SchoolSettings.schoolName` substituted at send time. The school name is never hardcoded in any template.

---

## 10. Status × Audit Log Entries

Every status transition writes an immutable `AuditLog` entry. No entry can be deleted.

| Status Transition | `actionType` | Description Template |
|---|---|---|
| Submitted online | `APPLICATION_SUBMITTED` | `Online application submitted — Tracking #[n], Applicant: [name]` |
| Entered F2F | `F2F_APPLICATION_ENTERED` | `F2F application entered by [user] for [name], Tracking #[n]` |
| → `APPROVED` | `APPLICATION_APPROVED` | `[user] approved [name] → Section [section]` |
| → `REJECTED` | `APPLICATION_REJECTED` | `[user] rejected [name] — Reason: [text]` |
| → `EXAM_SCHEDULED` | `EXAM_SCHEDULED` | `[user] scheduled [type] for [name] on [date]` |
| → `EXAM_TAKEN` | `EXAM_RESULT_RECORDED` | `[user] recorded result for [name]: [result] (Score: [score])` |
| → `PASSED` + `APPROVED` | `APPLICATION_PASSED` | `[user] marked [name] as PASSED, assigned to [section]` |
| → `FAILED` | `APPLICATION_FAILED` | `[user] marked [name] as FAILED. Notes: [notes]` |

---

## 11. Status Badge Visual Reference

Status badges appear in the application inbox table, detail view, and the slide-over panel.

| Status | Badge Style | Color | Icon |
|---|---|---|---|
| `PENDING` | Solid amber | `bg-amber-100 text-amber-800 border-amber-300` | ● |
| `EXAM_SCHEDULED` | Solid amber | `bg-amber-100 text-amber-800 border-amber-300` | ⏳ |
| `EXAM_TAKEN` | Solid blue | `bg-blue-100 text-blue-800 border-blue-300` | 📋 |
| `PASSED` | Solid green | `bg-green-100 text-green-800 border-green-300` | ✅ |
| `FAILED` | Solid red | `bg-red-100 text-red-800 border-red-300` | ❌ |
| `APPROVED` | Outline green | `bg-white text-green-700 border-green-500` | ◎ |
| `ENROLLED` | Solid green | `bg-green-500 text-white` | ✓ |
| `REJECTED` | Solid red | `bg-red-100 text-red-800 border-red-300` | ✗ |

```tsx
// client/src/components/StatusBadge.tsx
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING:        { label: 'Pending',        className: 'bg-amber-100 text-amber-800 border border-amber-300' },
  EXAM_SCHEDULED: { label: 'Exam Scheduled', className: 'bg-amber-100 text-amber-800 border border-amber-300' },
  EXAM_TAKEN:     { label: 'Exam Taken',     className: 'bg-blue-100 text-blue-800 border border-blue-300' },
  PASSED:         { label: 'Passed',         className: 'bg-green-100 text-green-800 border border-green-300' },
  FAILED:         { label: 'Failed',         className: 'bg-red-100 text-red-800 border border-red-300' },
  APPROVED:       { label: 'Approved',       className: 'bg-white text-green-700 border border-green-500' },
  ENROLLED:       { label: 'Enrolled',       className: 'bg-green-500 text-white' },
  REJECTED:       { label: 'Rejected',       className: 'bg-red-100 text-red-800 border border-red-300' },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
```

---

## 12. Valid Status Transitions — Full Table

These are the only valid transitions the system will accept. Any attempt to move to an invalid status returns `422 Unprocessable Entity`.

| From | To | Who | API Endpoint | Valid? |
|---|---|---|---|---|
| *(none)* | `PENDING` | System | `POST /api/applications` | ✅ |
| *(none)* | `PENDING` | System (F2F) | `POST /api/applications/f2f` | ✅ |
| `PENDING` | `APPROVED` | Registrar | `PATCH .../approve` | ✅ (Regular only) |
| `PENDING` | `REJECTED` | Registrar | `PATCH .../reject` | ✅ |
| `PENDING` | `EXAM_SCHEDULED` | Registrar | `PATCH .../schedule-exam` | ✅ (SCP only) |
| `EXAM_SCHEDULED` | `EXAM_TAKEN` | Registrar | `PATCH .../record-result` | ✅ |
| `EXAM_TAKEN` | `PASSED` → `APPROVED` | Registrar | `PATCH .../pass` | ✅ |
| `EXAM_TAKEN` | `FAILED` | Registrar | `PATCH .../fail` | ✅ |
| `FAILED` | `APPROVED` | Registrar | `PATCH .../fail` (with sectionId) | ✅ (offer regular) |
| `FAILED` | `REJECTED` | Registrar | `PATCH .../reject` | ✅ |
| `APPROVED` | `ENROLLED` | Registrar | *(Phase 2 confirmation)* | ✅ |
| `ENROLLED` | *(any)* | Anyone | — | ❌ Terminal — no transitions allowed |
| `REJECTED` | *(any)* | Anyone | — | ❌ Terminal — parent must resubmit fresh |
| `PENDING` | `ENROLLED` | Anyone | — | ❌ Must go through APPROVED first |
| `PENDING` | `PASSED` | Anyone | — | ❌ Must schedule exam first |
| `APPROVED` | `PENDING` | Anyone | — | ❌ Cannot reverse an approval |

---

## 13. Prisma & API Implementation

### Prisma Enum

```prisma
// server/prisma/schema.prisma
enum ApplicationStatus {
  PENDING
  EXAM_SCHEDULED
  EXAM_TAKEN
  PASSED
  FAILED
  APPROVED
  ENROLLED
  REJECTED
}
```

### Status Validation in Controllers

```ts
// server/src/services/applicationService.ts

// Guard: only allow valid transitions
export function assertValidTransition(
  current: ApplicationStatus,
  next:    ApplicationStatus,
  applicantType: string,
): void {
  const isRegular = applicantType === 'REGULAR';
  const isSCP     = !isRegular;

  const valid = new Map<ApplicationStatus, ApplicationStatus[]>([
    ['PENDING',        isRegular ? ['APPROVED', 'REJECTED']
                                 : ['EXAM_SCHEDULED', 'REJECTED']],
    ['EXAM_SCHEDULED', ['EXAM_TAKEN']],
    ['EXAM_TAKEN',     ['PASSED', 'FAILED']],      // PASSED immediately becomes APPROVED
    ['FAILED',         ['APPROVED', 'REJECTED']],  // offer regular = APPROVED
    ['APPROVED',       ['ENROLLED']],
    ['ENROLLED',       []],  // terminal
    ['REJECTED',       []],  // terminal
  ]);

  const allowed = valid.get(current) ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid status transition: ${current} → ${next} (type: ${applicantType})`);
  }
}
```

### API Endpoints

```ts
// server/src/routes/application.routes.ts
router.patch('/:id/approve',       authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.approve);
router.patch('/:id/reject',        authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.reject);
router.patch('/:id/schedule-exam', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.scheduleExam);
router.patch('/:id/record-result', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.recordResult);
router.patch('/:id/pass',          authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.pass);
router.patch('/:id/fail',          authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.fail);
```

### Filtering by Subnav View

```ts
// server/src/controllers/applicationController.ts

// Applications → Admission: active processing queue
const ADMISSION_STATUSES  = ['PENDING', 'EXAM_SCHEDULED', 'EXAM_TAKEN', 'PASSED', 'FAILED'];

// Applications → Enrollment: pre-registered + officially enrolled
const ENROLLMENT_STATUSES = ['APPROVED', 'ENROLLED'];

export async function admissionIndex(req: Request, res: Response) {
  const { status, gradeLevelId, applicantType, channel, page = '1' } = req.query;

  const where = {
    academicYearId: activeYear.id,
    status: status
      ? { in: [String(status)] }
      : { in: ADMISSION_STATUSES },
    ...(gradeLevelId  ? { gradeLevelId:  Number(gradeLevelId) }  : {}),
    ...(applicantType ? { applicantType: String(applicantType) }  : {}),
    ...(channel       ? { admissionChannel: String(channel) }     : {}),
  };

  const [applications, total] = await Promise.all([
    prisma.applicant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (Number(page) - 1) * 15,
      take:    15,
      include: { gradeLevel: true, strand: true },
    }),
    prisma.applicant.count({ where }),
  ]);

  res.json({ applications, total });
}

export async function enrollmentIndex(req: Request, res: Response) {
  // Same pattern but with ENROLLMENT_STATUSES
}
```

---

## 14. Phase 2 — What Happens to APPROVED Applicants in June

`APPROVED` applicants from Phase 1 return to school during Brigada Eskwela week (approximately one week before class opening in June). This is Phase 2 — Regular Enrollment.

**What the registrar does during Phase 2:**

1. Parent/learner arrives at the registrar's window
2. Registrar searches for the applicant in `/applications/enrollment` by name or LRN
3. Record shows status: `APPROVED` with section already assigned from Phase 1
4. Registrar verifies physical documents:
   - Original PSA Birth Certificate (against the PSA number noted in Phase 1)
   - Original Grade 6 / Grade 10 SF9 (signed by sending school head)
5. If all documents are complete and match the record: **no additional system action is strictly needed** — the enrollment record already exists from Phase 1
6. If a data correction is needed: `PUT /api/students/:id` → corrects the field → `AuditLog: STUDENT_RECORD_UPDATED`
7. Registrar informs the parent: *"Your child is officially enrolled."*

**The transition from APPROVED to ENROLLED** is the final confirmation step. In practice, many schools treat the `APPROVED` state as sufficient for counting enrollment numbers. The formal `ENROLLED` update in the system is done when the registrar has verified all Phase 2 documents.

**What if a Phase 1 APPROVED applicant does not show up in Phase 2?**

If a learner was `APPROVED` in Phase 1 but does not appear during Phase 2:
1. Registrar attempts to contact the parent via the phone number on record
2. If no response by the end of the enrollment period, the slot may be released
3. The registrar may formally reject the application with reason: *"Learner did not report during enrollment period. Contact was attempted."*
4. This follows the school head's decision — the system does not automatically release APPROVED slots

---

## 15. Edge Cases & Policy Rules

### Can the registrar skip EXAM_SCHEDULED and go directly to EXAM_TAKEN?

Only for **SPFL** (Special Program in Foreign Languages). SPFL uses the applicant's NAT English score from elementary school — there is no separate exam scheduled. The registrar enters the NAT score directly, moving from `PENDING` to `EXAM_TAKEN` in one step.

### What if the exam date needs to be rescheduled?

While in `EXAM_SCHEDULED` status, the registrar can update the `examDate` field by clicking **Edit Exam Date** in the application detail view. The status remains `EXAM_SCHEDULED`. A new notification email is sent to the parent.

### Can two SCP programs be applied for?

No. An applicant may only declare one SCP program on the BEEF. If a learner is interested in two programs (e.g., both STE and SPA), they must choose one. The school may have separate intake processes for multiple programs, but the system supports one `scpProgramCode` per `Applicant` record.

### What if the applicant is absent on the exam day?

The registrar opens the application in `EXAM_SCHEDULED` status and clicks **Record Assessment Result**. In the result dialog, there is an option: *"Did the applicant appear for the exam? Yes / No"*. If No (absent):
- Status stays in `EXAM_TAKEN` with `examResult: 'ABSENT'`
- Registrar decides: offer another exam date (re-schedule) or mark as `FAILED`
- School policy determines how absences are handled — the system does not enforce a specific rule

### Capacity and APPROVED applicants

Section capacity is checked at the time of approval. If a section reaches `maxCapacity` after some APPROVED applicants are entered, the section shows as FULL in the assignment dialog and cannot be selected. The registrar must either:
1. Increase the section's `maxCapacity` (with school head approval)
2. Create a new section for the grade level
3. Assign the new applicant to a different section

A learner is never rejected solely because sections are full — the school head resolves the capacity issue and the applicant is assigned once capacity is available.

### REJECTED status is permanent

A `REJECTED` applicant record cannot be un-rejected or moved back to `PENDING`. The correct action when a rejection was in error is to:
1. Have the parent submit a new application (new tracking number, new `Applicant` record)
2. The rejected record remains in the database permanently as an audit trail

---

*Document v1.0.0*
*System: School Admission, Enrollment & Information Management System*
*Module: Enrollment Management — Applications*
*Policy: DepEd Order No. 017, s. 2025 · DepEd Order No. 03, s. 2018 · DM 149, s. 2011 (SCP)*
*Statuses: PENDING · EXAM_SCHEDULED · EXAM_TAKEN · PASSED · FAILED · APPROVED · ENROLLED · REJECTED*
