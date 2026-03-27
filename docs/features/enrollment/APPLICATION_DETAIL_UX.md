# Application Detail — UI/UX Specification
## Viewing a Learner's Early Registration Application

**Document Version:** 1.0.0
**System:** School Admission, Enrollment & Information Management System
**Module:** Enrollment Management — Applications (`/applications/admission`)
**Primary Actor:** Registrar · System Administrator
**Design System:** shadcn/ui · Tailwind CSS v4 · Lucide React Icons · Instrument Sans
**Component Library:** `Sheet` · `Dialog` · `Tabs` · `Badge` · `Button` · `Card`

---

## Table of Contents

1. [Design Rationale — Why Two Tiers](#1-design-rationale--why-two-tiers)
2. [Tier 1 — Right-Side Slide-over Panel](#2-tier-1--right-side-slide-over-panel)
   - 2.1 [Panel Anatomy](#21-panel-anatomy)
   - 2.2 [Panel Header](#22-panel-header)
   - 2.3 [Applicant Summary Block](#23-applicant-summary-block)
   - 2.4 [BEEF Data Sections — Collapsed by Default](#24-beef-data-sections--collapsed-by-default)
   - 2.5 [SCP Assessment Block](#25-scp-assessment-block)
   - 2.6 [Status Timeline](#26-status-timeline)
   - 2.7 [Action Button Bar](#27-action-button-bar)
   - 2.8 [Panel Navigation — Moving Between Records](#28-panel-navigation--moving-between-records)
3. [Tier 2 — Full Detail Page](#3-tier-2--full-detail-page)
   - 3.1 [Page Header](#31-page-header)
   - 3.2 [Tab 1 — Personal Information](#32-tab-1--personal-information)
   - 3.3 [Tab 2 — Guardian & Address](#33-tab-2--guardian--address)
   - 3.4 [Tab 3 — Previous School & Classification](#34-tab-3--previous-school--classification)
   - 3.5 [Tab 4 — Assessment (SCP Only)](#35-tab-4--assessment-scp-only)
   - 3.6 [Status Timeline Block](#36-status-timeline-block)
4. [Action Dialogs](#4-action-dialogs)
   - 4.1 [Approve & Assign Section](#41-approve--assign-section)
   - 4.2 [Reject Application](#42-reject-application)
   - 4.3 [Schedule Assessment (SCP)](#43-schedule-assessment-scp)
   - 4.4 [Record Assessment Result (SCP)](#44-record-assessment-result-scp)
   - 4.5 [Mark as Failed — Offer Regular Section (SCP)](#45-mark-as-failed--offer-regular-section-scp)
5. [State Variations — Panel Per Status](#5-state-variations--panel-per-status)
6. [Responsive Behavior](#6-responsive-behavior)
7. [Interaction Flow — End to End](#7-interaction-flow--end-to-end)
8. [Component & File Structure](#8-component--file-structure)
9. [Accessibility](#9-accessibility)
10. [shadcn/ui Implementation Reference](#10-shadcnui-implementation-reference)

---

## 1. Design Rationale — Why Two Tiers

The registrar's daily workflow during Phase 1 Early Registration is fundamentally a **processing queue**. On a busy morning, the registrar may process 20–40 applications in sequence — scanning each record, verifying it against physical documents, and taking an action. The UI must support this rhythm without interrupting it.

### Why Not a Full Modal

A standard modal dialog is wrong for this use case:

| Problem | Detail |
|---|---|
| **Data volume** | The BEEF has 10 sections. A modal tall enough to show all of them becomes a cramped full page that still requires scrolling — the worst of both worlds |
| **No list context** | A modal hides the list. The registrar cannot see where they are in the queue or jump to the next record without closing first |
| **Not deep-linkable** | A modal cannot be bookmarked or shared with a colleague |
| **SCP multi-step** | SCP workflows span multiple days and multiple visits. A modal implies one-and-done. It does not fit a workflow where the registrar returns to the same record over days |

### Why Not Always a Full Page

A full page is correct for complex cases. But for a regular Grade 7 applicant — which makes up the majority of Phase 1 volume — the registrar needs to see the name, grade, LRN, and verify one thing before approving. Navigating away from the list for every single record is unnecessary friction.

### The Two-Tier Solution

```
TIER 1 — Right-Side Slide-over Panel
  When: Registrar clicks [View] on any row in the inbox list
  Width: ~45% of the viewport (min 480px)
  List: stays fully visible on the left
  Best for: Regular applicants; quick verify-and-approve; status check

  └── "View Full Details ↗" link inside the panel

TIER 2 — Full Detail Page (/applications/admission/:id)
  When: Registrar clicks "View Full Details ↗" from the panel
  OR: navigated directly (deep link, bookmark, shared URL)
  Best for: SCP multi-step workflow; careful data verification;
            editing records; complex cases
```

The two tiers share the same data — only the layout changes.

---

## 2. Tier 1 — Right-Side Slide-over Panel

### 2.1 Panel Anatomy

The panel uses `shadcn/ui Sheet` with `side="right"`. It renders over the list without navigating away.

```
┌──────────────────────────────────┬──────────────────────────────────────────────┐
│                                  │                                              │
│  ADMISSION APPLICANTS     (14)   │  ╔══════════════════════════════════════════╗│
│  [Search...]  [Filter ▾]         │  ║  APPLICATION DETAIL           [✕ Close] ║│
│  ─────────────────────────────── │  ║  #APP-2026-00055 · Online · Feb 3, 2026  ║│
│                                  │  ╠══════════════════════════════════════════╣│
│  ● 055  Dela Cruz, Juan  PENDING ◄─╫─ [selected, highlighted row]              ║│
│  ⏳ 053  Reyes, Pedro    EXAM_SCH │  ║                                          ║│
│  📋 052  Garcia, Ana     EXAM_TAK │  ║  DELA CRUZ, Juan Reyes        ● PENDING  ║│
│  ✅ 051  Torres, Carlo   PASSED   │  ║  Grade 7  ·  Regular Admission           ║│
│  ❌ 050  Lim, Rosa       FAILED   │  ║  LRN: 123456789012  ·  Age: 11           ║│
│  ● 049  Santos, Maria   PENDING  │  ║                                          ║│
│  ● 048  Reyes, Ana      PENDING  │  ║  ── PERSONAL ─────────────────────────   ║│
│  ...                             │  ║  Date of Birth  March 12, 2014           ║│
│                                  │  ║  Sex            Male                     ║│
│  [← Prev]    Row 1 of 14  [Next→]│  ║  Place of Birth [City], [Province]      ║│
│                                  │  ║  Mother Tongue  Hiligaynon               ║│
│                                  │  ║                                          ║│
│                                  │  ║  ── GUARDIAN ──────────────────────────  ║│
│                                  │  ║  Maria Dela Cruz (Mother)                ║│
│                                  │  ║  0917-123-4567                           ║│
│                                  │  ║  delacruz@gmail.com                      ║│
│                                  │  ║                                          ║│
│                                  │  ║  ── PREVIOUS SCHOOL ───────────────────  ║│
│                                  │  ║  [Elementary School Name]                ║│
│                                  │  ║  Grade 6  ·  SY 2024–2025  ·  Avg 92.5  ║│
│                                  │  ║                                          ║│
│                                  │  ║  ── CLASSIFICATIONS ───────────────────  ║│
│                                  │  ║  IP: No  ·  4Ps: No  ·  LWD: No         ║│
│                                  │  ║                                          ║│
│                                  │  ║  [ View Full Details ↗ ]                 ║│
│                                  │  ║                                          ║│
│                                  │  ╠══════════════════════════════════════════╣│
│                                  │  ║  [ Approve & Assign Section ]            ║│
│                                  │  ║  [ Reject Application ]                  ║│
│                                  │  ╚══════════════════════════════════════════╝│
└──────────────────────────────────┴──────────────────────────────────────────────┘
```

**Panel width:**
```css
/* shadcn Sheet override */
.application-detail-panel {
  width: 45%;
  min-width: 480px;
  max-width: 640px;
}
```

**List behavior while panel is open:**
- The list remains fully interactive — the registrar can click any other row to switch to that record
- The selected row is highlighted with `bg-accent/10 border-l-2 border-accent`
- The list does not re-fetch or scroll on panel open — it stays at its current scroll position

**Panel open/close:**
- Opens: clicking `[View]` on any row
- Closes: clicking `✕` · pressing `Escape` · clicking outside the panel (on the list area)
- State held in: `selectedApplicantId: number | null` in local component state (not URL — the panel is not a route)

---

### 2.2 Panel Header

```
╔══════════════════════════════════════════════════════╗
║  APPLICATION DETAIL                    [ ✕ Close ]  ║
║  #APP-2026-00055 · Online · Feb 3, 2026, 9:14 AM    ║
╚══════════════════════════════════════════════════════╝
```

| Element | Content | Source |
|---|---|---|
| Title | "APPLICATION DETAIL" | Static |
| Tracking number | `#APP-2026-00055` | `applicant.trackingNumber` |
| Channel badge | `Online` or `Walk-in (F2F)` | `applicant.admissionChannel` |
| Submitted date | `Feb 3, 2026, 9:14 AM` | `applicant.createdAt` — formatted with `date-fns` |
| Close button | `✕` icon — `X` from `lucide-react` | Closes panel; clears `selectedApplicantId` |

---

### 2.3 Applicant Summary Block

The first thing the registrar sees after the header. Provides enough identity information to match against the physical document in hand without scrolling.

```
╔══════════════════════════════════════════════════════╗
║                                                      ║
║  DELA CRUZ, Juan Reyes              ● PENDING        ║
║  Grade 7  ·  Regular Admission                       ║
║  LRN: 123456789012  ·  Age: 11 yrs, 10 mo            ║
║  Encoded: March 3, 2026 (Online)                     ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

**For SCP applicants — extra line:**
```
║  Grade 7  ·  ⚡ STE — Science, Technology & Engineering  ║
```

| Element | Content | Notes |
|---|---|---|
| Full name | `DELA CRUZ, Juan Reyes` — ALL CAPS | Last name first — matches how school records are formatted |
| Status badge | `● PENDING` | `StatusBadge` component — color matches the status |
| Grade level | `Grade 7` | From `gradeLevel.name` — never hardcoded |
| Program | `Regular Admission` or `⚡ [SCP Full Name]` | SCP badge uses amber/yellow outline to catch the eye |
| LRN | 12-digit number | Monospace font — easier to scan against physical SF9 |
| Age | Auto-computed from DOB | Shown as "11 yrs, 10 mo" — useful for age-appropriate grade check |
| Encoded | Submission date + channel | For F2F: shows the registrar's name who encoded it |

---

### 2.4 BEEF Data Sections — Collapsed by Default

The full BEEF is organized into four collapsed `<details>` sections. The registrar expands only the sections they need to verify. This avoids scrolling a wall of text for simple records.

```
  ▸ Personal Information           [click to expand]
  ▸ Guardian & Contact             [click to expand]
  ▸ Previous School                [click to expand]
  ▸ Special Classifications        [click to expand]
```

Clicking a section header expands it:

```
  ▾ Personal Information           [click to collapse]
  ─────────────────────────────────────────────────────
  Date of Birth    March 12, 2014 (Age: 11 yrs, 10 mo)
  Sex              Male
  Place of Birth   Bacolod City, Negros Occidental
  Nationality      Filipino
  Religion         Roman Catholic
  Mother Tongue    Hiligaynon
```

```
  ▾ Guardian & Contact
  ─────────────────────────────────────────────────────
  Mother           Maria Reyes Dela Cruz
  Father           Juan Dela Cruz Sr.
  Legal Guardian   Maria Reyes Dela Cruz (Mother)
  Contact          0917-123-4567
  Email            delacruz@gmail.com
  
  Current Address  123 Magsaysay St., Brgy. San Antonio,
                   Bacolod City, Negros Occidental
```

```
  ▾ Previous School
  ─────────────────────────────────────────────────────
  Last School      [Elementary School Name]
  Last Grade       Grade 6
  School Year      2024–2025
  General Average  92.5
```

```
  ▾ Special Classifications          [🔒 Sensitive]
  ─────────────────────────────────────────────────────
  IP Community     No
  4Ps Beneficiary  No
  Learner w/ Dis.  No
```

**Special Classifications section behavior:**
- Labeled with a `🔒 Sensitive` badge — visual cue that this is SPI under RA 10173
- SPI values shown only to REGISTRAR and SYSTEM_ADMIN (enforced by backend)
- If any SPI field is `Yes`, the value is shown in amber: `⚠ Yes — [sub-field value]`
- SPI data is **never shown in the list view** — only in the detail panel

**SHS Track & Cluster section (Grade 11 only):**
```
  ▾ SHS Enrollment Preferences
  ─────────────────────────────────────────────────────
  Track            Academic
  Elective Cluster STEM (Science, Technology, Engineering & Mathematics)
  G10 Science      88.5
  G10 Mathematics  90.0
```

**Learner Type & Modality section:**
```
  ▾ Enrollment Details
  ─────────────────────────────────────────────────────
  Learner Type     New Enrollee
  Modality         Face-to-Face
  SCP Application  None (Regular)
```

---

### 2.5 SCP Assessment Block

Only shown when `applicant.applicantType !== 'REGULAR'`. Renders between the BEEF sections and the action buttons.

```
  ⚡ SCP ASSESSMENT — Science, Technology & Engineering (STE)
  ─────────────────────────────────────────────────────────────
  Assessment Type   Written Entrance Exam
  
  Exam Date         Not yet scheduled
  Exam Score        —
  Exam Result       —
  Notes             —
```

As the SCP workflow progresses, this block updates in real time:

**After `EXAM_SCHEDULED`:**
```
  Exam Date         February 22, 2027 (Saturday)
  Venue             Room 201 — Main Building
  Exam Score        —
  Exam Result       Pending
```

**After `EXAM_TAKEN` (passed):**
```
  Exam Date         February 22, 2027
  Exam Score        87.5 / 100
  Exam Result       ✓ PASSED — meets cut-off of 75.0
  Notes             Top 15% of division examinees
```

**After `EXAM_TAKEN` (failed):**
```
  Exam Date         February 22, 2027
  Exam Score        62.0 / 100
  Exam Result       ✗ FAILED — below cut-off of 75.0
  Notes             —
```

**For SPA (Exam + Audition):**
```
  Assessment Type   Written Exam + Portfolio Audition
  Exam Score        80.0 / 100    ✓ Cleared
  Audition Result   ✓ Cleared — Portfolio accepted
```

**For SPS (Audition Only):**
```
  Assessment Type   Sports Tryout
  Tryout Date       February 20, 2027
  Tryout Result     ✗ Not Cleared
```

**For SPFL (NAT Score review):**
```
  Assessment Type   NAT English Score Review
  NAT Score         82.5           ✓ Meets cut-off of 75.0
```

---

### 2.6 Status Timeline

A compact vertical timeline at the bottom of the scrollable panel content, just above the action buttons. Shows the full history of this application.

```
  STATUS TIMELINE
  ─────────────────────────────────────────────────
  ● Feb 3, 2026  9:14 AM   Application Submitted
                            Online · #APP-2026-00055

  ● Feb 5, 2026 10:32 AM   Exam Scheduled
                            Cruz, Regina
                            Exam date: Feb 22, 2027

  ● Mar 1, 2026  8:45 AM   Result Recorded
                            Cruz, Regina
                            Score: 87.5 — PASSED
```

Each entry shows: timestamp · registrar name (if applicable) · action description. Derived from `AuditLog` entries filtered by `subjectId = applicant.id`.

---

### 2.7 Action Button Bar

The action buttons are **anchored to the bottom** of the panel with a sticky footer — they are always visible regardless of how far the registrar has scrolled. The registrar never needs to scroll down to reach the action buttons.

```
╠═══════════════════════════════════════════════════════╣
║  [ View Full Details ↗ ]         [opens /admission/55]║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║   [ ✓ Approve & Assign Section ]     [primary]        ║
║   [ ✗ Reject Application     ]     [destructive]      ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

**Button rules per status:**

The sticky footer renders different buttons based on `applicantType + status`. The registrar never sees buttons that are not applicable to the current state.

| Status | Primary Button | Secondary Button |
|---|---|---|
| `PENDING` (Regular) | `✓ Approve & Assign Section` (accent) | `✗ Reject Application` (destructive outline) |
| `PENDING` (SCP) | `📅 Verify & Schedule Exam` (accent) | `✗ Reject Application` (destructive outline) |
| `EXAM_SCHEDULED` | `📝 Record Assessment Result` (accent) | — |
| `EXAM_TAKEN` | `✅ Mark as Passed` (accent) | `❌ Mark as Failed` (destructive outline) |
| `PASSED` | `✅ Assign Section` (accent) | — |
| `FAILED` | `🔄 Offer Regular Section` (accent) | `✗ Reject` (destructive outline) |
| `APPROVED` | — (no actions — decisions made) | — |
| `ENROLLED` | — (terminal — no actions) | — |
| `REJECTED` | — (terminal — no actions) | — |

**"View Full Details ↗" link:**
- Always present regardless of status
- `target="_blank"` — opens the full detail page in a new tab so the registrar does not lose their panel state
- Styled as a subtle secondary link button, not a primary action

---

### 2.8 Panel Navigation — Moving Between Records

When the panel is open, the registrar can navigate through the inbox without closing it. Two mechanisms:

**Mechanism 1 — Click a different row:**
The highlighted row changes, the panel content updates. No panel close/reopen animation.

**Mechanism 2 — Prev/Next arrow buttons at the bottom of the list:**
```
[← Prev]    Row 6 of 14    [Next →]
```

These appear at the bottom of the list only when a panel is open. Clicking → moves to the next row in the current filtered+sorted order. The panel content smoothly updates with the new applicant's data.

**Loading state:**
When switching between records, the panel content shows a skeleton loader while fetching:
```
  ████████████████████ 40%    ← name skeleton
  ██████ 20%                  ← grade/type skeleton
  ─────────────────────────
  ██████████████ 60%          ← field skeleton
  █████████ 40%
  ...
```

Uses `shadcn/ui Skeleton` — not a spinner. Skeleton matches the exact layout of the content it is replacing.

---

## 3. Tier 2 — Full Detail Page

**Route:** `/applications/admission/:id`
**Page component:** `client/src/pages/applications/AdmissionDetail.tsx`
**API:** `GET /api/applications/:id`

The full detail page is used for:
- SCP multi-step workflows (multiple visits over days)
- Careful data verification against physical documents
- Cases where the registrar needs to read all fields at once
- Deep linking and sharing with a colleague

---

### 3.1 Page Header

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Admission Applicants                                             │
│                                                                             │
│  DELA CRUZ, Juan Reyes                               ● PENDING              │
│  Grade 7  ·  Regular Admission  ·  Online  ·  Feb 3, 2026                  │
│  LRN: 123456789012                    Tracking #: APP-2026-00055            │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  [ ✓ Approve & Assign Section ]    [ ✗ Reject Application ]                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Back button:** Returns to `/applications/admission` — preserves the list's previous filter/page state using `useNavigate(-1)` so the registrar does not lose their place in the queue.

**Action buttons in the header:** Same conditional rendering logic as the panel's sticky footer. Duplicated here so the registrar can act without scrolling to the bottom of the page.

**Status badge:** Same `StatusBadge` component used in the list and panel.

---

### 3.2 Tab 1 — Personal Information

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Personal Info  │  Guardian & Address  │  Prev. School & Classification  │  Assessment (SCP)  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LEARNER IDENTITY                                                            │
│  ──────────────────────────────────────────────────────                      │
│  LRN              123456789012                         [read-only always]    │
│  PSA BC No.       PSA-2014-0042381                                           │
│  Tracking #       APP-2026-00055                       [read-only always]    │
│  Submitted        February 3, 2026 at 9:14 AM (Online)                      │
│  Encoded By       — (self-submitted online)                                  │
│                                                                              │
│  PERSONAL INFORMATION                                                        │
│  ──────────────────────────────────────────────────────                      │
│  Last Name        DELA CRUZ                                                  │
│  First Name       Juan                                                       │
│  Middle Name      Reyes                                                      │
│  Suffix           N/A                                                        │
│  Date of Birth    March 12, 2014                       Age: 11 yrs, 10 mo   │
│  Sex              Male                                                       │
│  Place of Birth   Bacolod City, Negros Occidental                            │
│  Nationality      Filipino                                                   │
│  Religion         Roman Catholic                                             │
│  Mother Tongue    Hiligaynon                                                 │
│                                                                              │
│  ENROLLMENT PREFERENCE                                                       │
│  ──────────────────────────────────────────────────────                      │
│  Grade Level      Grade 7                                                    │
│  Program          Regular Admission                                          │
│  Learner Type     New Enrollee                                               │
│  Modality         Face-to-Face                                               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Display rules:**
- All fields are **read-only** in this view — the registrar cannot edit from the Application Detail page
- Edits to a learner's record are done from the SIMS (`/students/:id`) after the learner is enrolled
- LRN and Tracking # are always read-only — they are immutable identifiers
- "Encoded By" shows the registrar's name for F2F applications; shows "—" for self-submitted online applications

**For SCP applicants, the Enrollment Preference block shows:**
```
│  Grade Level      Grade 7                                                    │
│  Program          ⚡ STE — Science, Technology & Engineering                 │
│  Learner Type     New Enrollee                                               │
│  Modality         Face-to-Face                                               │
```

**For Grade 11 applicants, adds:**
```
│  SHS Track        Academic                                                   │
│  Elective Cluster STEM (Science, Technology, Engineering & Mathematics)      │
│  G10 Science      88.5                                                       │
│  G10 Mathematics  90.0                                                       │
```

---

### 3.3 Tab 2 — Guardian & Address

```
│  PARENT / GUARDIAN INFORMATION                                               │
│  ──────────────────────────────────────────────────────                      │
│  Father           Juan Dela Cruz Sr.         0917-123-4500                  │
│  Mother           Maria Reyes Dela Cruz       0917-123-4567                  │
│  Legal Guardian   Maria Reyes Dela Cruz (Mother)                            │
│  Contact Number   0917-123-4567                                              │
│  Email Address    delacruz@gmail.com                                         │
│                                                                              │
│  CURRENT ADDRESS                                                             │
│  ──────────────────────────────────────────────────────                      │
│  123 Magsaysay Street, Brgy. San Antonio                                     │
│  Bacolod City, Negros Occidental, Philippines 6100                           │
│                                                                              │
│  PERMANENT ADDRESS                                                           │
│  ──────────────────────────────────────────────────────                      │
│  Same as current address                                                     │
```

---

### 3.4 Tab 3 — Previous School & Classification

```
│  PREVIOUS SCHOOL                                                             │
│  ──────────────────────────────────────────────────────                      │
│  School Name      [Elementary School Full Name]                              │
│  School ID        123456 (DepEd EBEIS ID)                                    │
│  Last Grade       Grade 6                                                    │
│  School Year      2024–2025                                                  │
│  General Average  92.5                                                       │
│                                                                              │
│  SPECIAL CLASSIFICATIONS                       [🔒 Sensitive — RA 10173]     │
│  ──────────────────────────────────────────────────────                      │
│  IP Community     No                                                         │
│  4Ps Beneficiary  No                                                         │
│  LWD              No                                                         │
```

**If any SPI field is "Yes":**
```
│  4Ps Beneficiary  ⚠ Yes                                                     │
│  4Ps Household ID 1234567890                                                 │
│                                                                              │
│  LWD              ⚠ Yes                                                     │
│  Disability Type  Hearing Impairment                                         │
```

The amber `⚠ Yes` styling draws the registrar's attention — these learners may need additional support coordination (SPED coordinator, DSWD, etc.).

**SPI access note:** This tab is rendered only for REGISTRAR and SYSTEM_ADMIN roles. The API endpoint `GET /api/applications/:id` returns the SPI fields only when the JWT role is REGISTRAR or SYSTEM_ADMIN — never for unauthenticated requests.

---

### 3.5 Tab 4 — Assessment (SCP Only)

This tab only appears in the tab bar when `applicant.applicantType !== 'REGULAR'`. If the applicant is a Regular admission, this tab is hidden entirely.

```
│  ⚡ SCP ASSESSMENT — Science, Technology & Engineering (STE)                 │
│  Assessment Type: Written Entrance Exam (EXAM_ONLY)                          │
│                                                                              │
│  ASSESSMENT SCHEDULE                                                         │
│  ──────────────────────────────────────────────────────                      │
│  Exam Date        February 22, 2027 (Saturday)                               │
│  Venue            Room 201 — Main Building                                   │
│  Scheduled By     Cruz, Regina (Feb 5, 2026)                                 │
│                                                                              │
│  ASSESSMENT RESULT                                                           │
│  ──────────────────────────────────────────────────────                      │
│  Exam Score       87.5 / 100                                                 │
│  Cut-off Score    75.0                                                       │
│  Exam Result      ✓ PASSED                                                   │
│  Recorded By      Cruz, Regina (Mar 1, 2026)                                 │
│  Notes            Top 15% of division examinees                              │
│                                                                              │
│  INTERVIEW RESULT  (for SPJ / STEM G11)                                      │
│  ──────────────────────────────────────────────────────                      │
│  Interview Date   March 5, 2026                                              │
│  Interview Result ✓ Cleared                                                  │
│  Interview Notes  Demonstrates strong analytical reasoning                   │
```

All fields in this tab are read-only — they are set only through the action dialogs (Schedule Exam, Record Result). The registrar uses this tab to review the full assessment history for a learner across multiple sessions.

---

### 3.6 Status Timeline Block

Shown below all tabs on the full detail page. Read-only, reverse chronological.

```
STATUS TIMELINE
─────────────────────────────────────────────────────────────────────
●  March 1, 2026  8:45 AM    Assessment Result Recorded
                              Cruz, Regina · Score: 87.5 · PASSED

●  February 5, 2026  10:32 AM   Exam Scheduled
                              Cruz, Regina · Date: Feb 22, 2027

●  February 3, 2026  9:14 AM    Application Submitted
                              Self-submitted · Online · #APP-2026-00055
```

Each timeline entry is a `Card` with:
- Color-coded left border matching the status it triggered
- Timestamp (date + time)
- Actor (registrar name, or "Self-submitted" for online)
- Action description
- Relevant detail (score, exam date, section name, reason, etc.)

---

## 4. Action Dialogs

All actions open a `shadcn/ui Dialog` — a focused modal for a single decision. The `Sheet` panel and the full detail page both use the same dialog components.

---

### 4.1 Approve & Assign Section

Triggered by: `[ ✓ Approve & Assign Section ]` button on PENDING status (Regular admission).

```
┌─────────────────────────────────────────────────────────────────────┐
│  Assign Section                                        [✕]          │
│  DELA CRUZ, Juan Reyes  ·  Grade 7                                  │
│  ─────────────────────────────────────────────────────────────────  │
│  Available Sections for Grade 7:                                    │
│                                                                     │
│  ○  Rizal       Adviser: Ms. Santos     38 / 45   ● 7 available    │
│  ○  Bonifacio   Adviser: Mr. Reyes      41 / 45   ● 4 available    │
│  ○  Luna        Adviser: Ms. Flores     44 / 45   ⚠ 1 remaining    │
│  ✗  Mabini      Adviser: Mr. Torres     45 / 45   ✗ FULL           │
│  ✗  Aguinaldo   Adviser: —              45 / 45   ✗ FULL           │
│                                                                     │
│  ⚠ Selecting "Luna" assigns the last available slot.               │
│    Once confirmed, the section will be full.                        │
│                                                                     │
│          [ Cancel ]            [ Confirm Enrollment ]               │
└─────────────────────────────────────────────────────────────────────┘
```

**Section list behavior:**
- Loaded from `GET /api/sections?gradeLevelId=&academicYearId=` for the active AY
- Each row shows: section name · adviser name (if assigned, from Teacher directory) · enrolled count / max capacity · available slots
- Full sections (`enrolled >= maxCapacity`) are shown but disabled — radio button is non-interactive, row text is `text-muted-foreground`
- Sections at ≥ 80% capacity show an amber `⚠` warning
- The last available slot triggers an inline amber warning below the radio list

**Capacity bar colors:**
```
< 80% capacity   →  bg-green-500   (●  available)
80–99% capacity  →  bg-amber-500   (⚠  near full)
= 100% capacity  →  bg-red-500     (✗  full — disabled)
```

These are **semantic colors only** — never the school's accent color. Consistency across all schools requires these to always mean the same thing.

**On "Confirm Enrollment":**
- `PATCH /api/applications/:id/approve { sectionId }` with PostgreSQL `FOR UPDATE` row lock
- Panel and list both update immediately: status badge changes to `✓ APPROVED`
- Application row moves from the Admission view to the Enrollment view on next refresh
- Sileo toast: *"✓ DELA CRUZ, Juan Reyes enrolled — Grade 7 Rizal"*
- Email sent asynchronously: `EnrollmentConfirmed` template

**On race condition (someone else took the last slot):**
- Server returns `409 Conflict`: *"Section Rizal is now full. Please select another section."*
- Dialog stays open, section list re-fetches and shows the section as FULL
- No changes applied

---

### 4.2 Reject Application

Triggered by: `[ ✗ Reject Application ]` on PENDING or FAILED status.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Reject Application                                      [✕]         │
│  DELA CRUZ, Juan Reyes  ·  #APP-2026-00055                           │
│  ─────────────────────────────────────────────────────────────────   │
│  ⚠  Rejection must only be used for verified data integrity issues.  │
│     Per DO 017, s. 2025 — NEVER reject for:                          │
│     · Missing documents (set as Pending instead)                     │
│     · Disability or IP status                                        │
│     · Unpaid fees at previous school                                 │
│  ─────────────────────────────────────────────────────────────────   │
│  Reason for Rejection  (optional but strongly recommended)           │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  The LRN provided belongs to a different learner per           │  │
│  │  DepEd LIS records. Please resubmit with the correct LRN.     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  150 / 500 characters                                                │
│                                                                      │
│  ⚠  The parent/guardian will be notified by email with this reason.  │
│                                                                      │
│          [ Cancel ]              [ Confirm Rejection ]               │
└──────────────────────────────────────────────────────────────────────┘
```

**Design decisions:**
- The DO 017 policy reminder is always visible at the top of the dialog — the registrar is reminded of what is and is not a valid rejection reason every time
- Reason textarea is optional but strongly recommended — the email to the parent includes the reason verbatim
- 500-character limit on reason
- Character count shown live below the textarea
- "Confirm Rejection" is styled as `variant="destructive"` — red background — making it visually distinct from the primary approval action

**On confirm:**
- `PATCH /api/applications/:id/reject { rejectionReason }`
- Panel: status badge updates to `✗ REJECTED`, action buttons replaced with "No further actions available"
- Application row: status badge changes in the list, row becomes visually de-emphasized (`text-muted-foreground`)
- Sileo toast: *"Application rejected — #APP-2026-00055"*
- Email sent: `ApplicationRejected` template with reason text

---

### 4.3 Schedule Assessment (SCP)

Triggered by: `[ 📅 Verify & Schedule Exam ]` on SCP PENDING status.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Schedule Assessment                                     [✕]         │
│  REYES, Pedro Manuel  ·  Grade 7  ·  STE                             │
│  ─────────────────────────────────────────────────────────────────   │
│  ✓ Documents Verified                                                │
│    SF9 (Grade 6 Report Card) and PSA Birth Certificate               │
│    have been checked and filed.                                      │
│  ─────────────────────────────────────────────────────────────────   │
│  Assessment Type: Written Entrance Exam (STE)                        │
│                                                                      │
│  Exam Date  *                                                        │
│  [ February 22, 2027   📅 ]                                          │
│                                                                      │
│  Venue  (optional)                                                   │
│  [ Room 201 — Main Building                   ]                      │
│                                                                      │
│  ⓘ An email with the exam date and venue will be sent to the         │
│    parent/guardian at delacruz@gmail.com.                            │
│                                                                      │
│          [ Cancel ]              [ Schedule Exam ]                   │
└──────────────────────────────────────────────────────────────────────┘
```

**Document verification confirmation:**
The "✓ Documents Verified" section is a read-only display — not a checkbox. The act of clicking "Schedule Exam" constitutes the registrar's attestation that they have verified the physical documents. The system does not require an explicit checkbox because the workflow itself implies verification — you do not schedule an SCP exam for an applicant whose documents have not been checked.

**On confirm:**
- `PATCH /api/applications/:id/schedule-exam { examDate, venue }`
- Panel SCP block updates: shows exam date and venue
- Status changes to `EXAM_SCHEDULED`
- Email sent: `ExamScheduled` template

---

### 4.4 Record Assessment Result (SCP)

Triggered by: `[ 📝 Record Assessment Result ]` on EXAM_SCHEDULED status.

The dialog's fields vary based on the SCP program's `assessmentType`. The system reads `ScpProgram.assessmentType` and renders only the relevant fields.

**For `EXAM_ONLY` (STE, SPJ, STEM G11):**
```
┌──────────────────────────────────────────────────────────────────────┐
│  Record Assessment Result                                [✕]         │
│  REYES, Pedro Manuel  ·  STE  ·  Exam Date: Feb 22, 2027             │
│  ─────────────────────────────────────────────────────────────────   │
│  Did the applicant appear for the exam?                              │
│  ●  Yes    ○  No (Absent)                                            │
│  ─────────────────────────────────────────────────────────────────   │
│  Exam Score  *  (0 – 100)                                            │
│  [ 87.5 ]                                                            │
│                                                                      │
│  Division Cut-off Score   75.0                                       │
│                           ✓ 87.5 ≥ 75.0 — Meets cut-off             │
│                                                                      │
│  Notes  (optional)                                                   │
│  [ Top 15% of division examinees                 ]                   │
│                                                                      │
│          [ Cancel ]              [ Save Result ]                     │
└──────────────────────────────────────────────────────────────────────┘
```

**Cut-off score feedback:**
As the registrar types the score, an inline indicator shows immediately whether it meets the SDO-announced cut-off:
- `✓ 87.5 ≥ 75.0 — Meets cut-off` (green)
- `✗ 62.0 < 75.0 — Below cut-off` (red)

The cut-off is pulled from `ScpProgram.cutoffScore` (or entered manually if variable). If no cut-off is stored in the database, the indicator is hidden and the registrar decides the pass/fail manually in the next step.

**For `EXAM_AUDITION` (SPA):**
```
│  Exam Score  *     [ 80.0 ]       ✓ Meets cut-off
│  Audition Result * ●  Cleared    ○  Not Cleared
```

**For `AUDITION_ONLY` (SPS):**
```
│  Tryout Result  *  ●  Cleared    ○  Not Cleared
│  Notes             [ Excellent ball control and stamina   ]
```

**For `NAT_REVIEW` (SPFL):**
```
│  NAT English Score  *    [ 82.5 ]
│  Cut-off             75.0
│                      ✓ Meets cut-off
```

**On absent:**
If "No (Absent)" is selected, the score field is hidden. The registrar can:
- Reschedule (choose a new exam date → dialog closes, returns to EXAM_SCHEDULED)
- Mark as Failed (no score recorded)

---

### 4.5 Mark as Failed — Offer Regular Section (SCP)

Triggered by: `[ ❌ Mark as Failed ]` on EXAM_TAKEN status.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Assessment Result — Not Qualified                        [✕]        │
│  LIM, Rosa Angela  ·  STE  ·  Score: 62.0 (cut-off: 75.0)           │
│  ─────────────────────────────────────────────────────────────────   │
│  ⚠  Per DO 017, s. 2025 — A failed SCP assessment is NEVER grounds   │
│     for denying basic education enrollment.                           │
│     The school must offer a placement in the regular program.         │
│  ─────────────────────────────────────────────────────────────────   │
│  What would you like to do?                                          │
│                                                                      │
│  ●  Offer a Regular Section                                          │
│     Switch Rosa to the regular program and assign a Grade 7          │
│     section. She will be enrolled in the regular curriculum.         │
│                                                                      │
│  ○  Reject Application                                               │
│     Only if the parent/guardian has explicitly confirmed they        │
│     will not accept a regular section placement and the learner      │
│     will enroll elsewhere.                                           │
│                                                                      │
│          [ Cancel ]              [ Confirm ]                         │
└──────────────────────────────────────────────────────────────────────┘
```

**If "Offer a Regular Section" is selected on confirm:**
- Dialog closes
- Section assignment dialog (§4.1) opens immediately — showing all regular (non-SCP) sections for the grade level
- `applicantType` is updated to `REGULAR` in the database
- On section confirm: status → `APPROVED`

**If "Reject Application" is selected on confirm:**
- An inline text area appears asking for the reason: *"Please note the parent's statement that the learner will not accept a regular section placement."*
- On confirm: status → `REJECTED`
- The reason field is required when rejecting from a FAILED state

**The DO 017 policy reminder** is a prominent amber banner at the top of the dialog — always visible, not dismissible. It is a permanent design element of this dialog, not a notification.

---

## 5. State Variations — Panel Per Status

The panel content changes meaningfully based on the applicant's current status. The layout structure stays the same, but the SCP block, action buttons, and timeline tell a different story at each stage.

### PENDING — Regular Applicant

```
╔══════════════════════════════════════════════════════╗
║ #APP-2026-00055 · Online · Feb 3, 2026               ║
╠══════════════════════════════════════════════════════╣
║ DELA CRUZ, Juan Reyes                    ● PENDING   ║
║ Grade 7  ·  Regular Admission                        ║
║ LRN: 123456789012  ·  Age: 11                        ║
╠══════════════════════════════════════════════════════╣
║ ▸ Personal Info  ▸ Guardian  ▸ Prev. School  ▸ Class.║
╠══════════════════════════════════════════════════════╣
║ TIMELINE                                             ║
║ ● Feb 3, 2026  Submitted (Online)                    ║
╠══════════════════════════════════════════════════════╣
║ [ View Full Details ↗ ]                              ║
╠══════════════════════════════════════════════════════╣
║ [ ✓ Approve & Assign Section ]   [ ✗ Reject ]        ║
╚══════════════════════════════════════════════════════╝
```

### PENDING — SCP Applicant

```
╔══════════════════════════════════════════════════════╗
║ #APP-2026-00053 · Online · Feb 3, 2026               ║
╠══════════════════════════════════════════════════════╣
║ REYES, Pedro Manuel               ● PENDING          ║
║ Grade 7  ·  ⚡ STE                                   ║
╠══════════════════════════════════════════════════════╣
║ ▸ Personal Info  ▸ Guardian  ▸ Prev. School  ▸ Class.║
╠══════════════════════════════════════════════════════╣
║ ⚡ STE ASSESSMENT                                    ║
║ Type: Written Entrance Exam                          ║
║ Exam Date:    Not yet scheduled                      ║
║ Exam Score:   —                                      ║
║ Result:       —                                      ║
╠══════════════════════════════════════════════════════╣
║ TIMELINE                                             ║
║ ● Feb 3, 2026  Submitted (Online)                    ║
╠══════════════════════════════════════════════════════╣
║ [ 📅 Verify & Schedule Exam ]    [ ✗ Reject ]        ║
╚══════════════════════════════════════════════════════╝
```

### EXAM_SCHEDULED

```
╠══════════════════════════════════════════════════════╣
║ REYES, Pedro Manuel              ⏳ EXAM_SCHEDULED   ║
╠══════════════════════════════════════════════════════╣
║ ⚡ STE ASSESSMENT                                    ║
║ Exam Date:    Feb 22, 2027 (Saturday)                ║
║ Venue:        Room 201 — Main Building               ║
║ Score:        —  (exam not yet taken)                ║
╠══════════════════════════════════════════════════════╣
║ TIMELINE                                             ║
║ ● Feb 5, 2026  Exam Scheduled · Cruz, Regina         ║
║ ● Feb 3, 2026  Submitted (Online)                    ║
╠══════════════════════════════════════════════════════╣
║ [ 📝 Record Assessment Result ]                      ║
╚══════════════════════════════════════════════════════╝
```

### EXAM_TAKEN

```
║ REYES, Pedro Manuel              📋 EXAM_TAKEN       ║
╠══════════════════════════════════════════════════════╣
║ ⚡ STE ASSESSMENT                                    ║
║ Exam Date:    Feb 22, 2027                           ║
║ Exam Score:   87.5 / 100                             ║
║ Cut-off:      75.0   ✓ Meets cut-off                 ║
║ Notes:        Top 15% of division examinees          ║
╠══════════════════════════════════════════════════════╣
║ [ ✅ Mark as Passed ]    [ ❌ Mark as Failed ]        ║
╚══════════════════════════════════════════════════════╝
```

### PASSED

```
║ REYES, Pedro Manuel                  ✅ PASSED       ║
╠══════════════════════════════════════════════════════╣
║ ⚡ STE ASSESSMENT                                    ║
║ Score:   87.5 / 100    ✓ Passed — assign SCP section ║
╠══════════════════════════════════════════════════════╣
║ [ ✅ Assign Section ]                                ║
╚══════════════════════════════════════════════════════╝
```

### FAILED

```
║ LIM, Rosa Angela                     ❌ FAILED       ║
╠══════════════════════════════════════════════════════╣
║ ⚡ STE ASSESSMENT                                    ║
║ Score:  62.0 / 100   ✗ Below cut-off of 75.0         ║
╠══════════════════════════════════════════════════════╣
║ [ 🔄 Offer Regular Section ]   [ ✗ Reject ]          ║
╚══════════════════════════════════════════════════════╝
```

### APPROVED (terminal in Phase 1)

```
║ DELA CRUZ, Juan Reyes              ◎ APPROVED        ║
║ Grade 7 — Rizal (Ms. Santos)                         ║
╠══════════════════════════════════════════════════════╣
║ ✓ Phase 1 complete — learner is pre-registered.      ║
║   Awaiting Phase 2 confirmation in June.             ║
╠══════════════════════════════════════════════════════╣
║ TIMELINE                                             ║
║ ● Feb 3, 2026  Approved — Grade 7 Rizal · Cruz, R.   ║
║ ● Feb 3, 2026  Submitted (Online)                    ║
╠══════════════════════════════════════════════════════╣
║ [ View Full Details ↗ ]                              ║
╚══════════════════════════════════════════════════════╝
```

### REJECTED (terminal)

```
║ GARCIA, Ana B.                      ✗ REJECTED       ║
╠══════════════════════════════════════════════════════╣
║ Rejection Reason:                                    ║
║ "The LRN provided belongs to a different learner     ║
║  per DepEd LIS records."                             ║
║                                                      ║
║ ⓘ Parent notified by email on Feb 3, 2026.           ║
║   The applicant may resubmit with corrected data.    ║
╠══════════════════════════════════════════════════════╣
║ [ View Full Details ↗ ]                              ║
╚══════════════════════════════════════════════════════╝
```

---

## 6. Responsive Behavior

| Viewport | Behavior |
|---|---|
| `≥ 1280px` (desktop wide) | Full two-column layout — list 55% · panel 45% |
| `1024px – 1279px` (desktop standard) | List collapses to icon + name only; panel 50% min-width |
| `768px – 1023px` (tablet) | Panel opens as a full-width bottom sheet (`side="bottom"`, h-[90vh]); list hidden behind panel |
| `< 768px` (mobile) | Panel opens as a full-screen overlay — occupies the entire viewport |

**On tablet and mobile, the panel is full-screen** because the side-by-side layout does not work at narrow widths. The panel gets a "← Back to List" button instead of ✕ Close.

```tsx
// Determine panel side based on viewport
const { width } = useWindowSize();
const side = width >= 768 ? 'right' : 'bottom';
const className = width >= 768
  ? 'w-[45%] min-w-[480px] max-w-[640px]'
  : 'h-[90vh]';

<Sheet>
  <SheetContent side={side} className={className}>
    ...
  </SheetContent>
</Sheet>
```

---

## 7. Interaction Flow — End to End

### Scenario A — Registrar approves a regular Grade 7 applicant in one visit

```
1. Registrar opens /applications/admission
2. Sees inbox list with 14 PENDING applications
3. Clicks [View] on row #055 (Dela Cruz, Juan)
4. Panel slides in from the right
5. Registrar scans:
     · Name matches PSA BC in hand ✓
     · LRN matches SF9 ✓
     · Grade 7 · Regular ✓
6. Clicks "▸ Previous School" to expand — verifies avg: 92.5 ✓
7. Clicks [ ✓ Approve & Assign Section ]
8. Section dialog opens — selects "Rizal (38/45)"
9. Clicks [ Confirm Enrollment ]
10. Panel updates: status badge → ◎ APPROVED
    "Phase 1 complete — learner is pre-registered."
11. Row in list: Dela Cruz disappears from Admission view (moved to Enrollment)
12. Toast: "✓ DELA CRUZ, Juan Reyes enrolled — Grade 7 Rizal"
13. Registrar clicks row #049 (Santos, Maria) without closing panel
14. Panel content swaps to Santos' record
    ← Total time: ~60 seconds per applicant
```

### Scenario B — SCP applicant (STE) spanning multiple days

```
Day 1 — Document verification:
1. Registrar opens /applications/admission
2. Clicks [View] on STE applicant (Reyes, Pedro)
3. Panel shows: PENDING · STE · Exam not scheduled
4. Verifies SF9 and PSA BC in hand
5. Clicks [ 📅 Verify & Schedule Exam ]
6. Schedule dialog: enters Feb 22, 2027 · Room 201
7. Confirms → status → EXAM_SCHEDULED
8. Email sent to parent with exam date

Day 2 (Feb 22) — Exam day (registrar does nothing in system)

Day 3 — After exam results released:
1. Registrar finds Pedro's record in EXAM_SCHEDULED filter
2. Clicks [View] → panel shows score field ready
3. Clicks [ 📝 Record Assessment Result ]
4. Enters score: 87.5. Inline: ✓ Meets cut-off 75.0
5. Confirms → status → EXAM_TAKEN

Day 4 — Pass/Fail decision:
1. Pedro's record is in EXAM_TAKEN filter
2. Registrar clicks [ ✅ Mark as Passed ]
3. Section dialog opens — only STE-A section shown
4. Confirms → status → APPROVED · STE section assigned
5. Email: "Congratulations! Pedro passed the STE Assessment"
```

---

## 8. Component & File Structure

```
client/src/
├── pages/
│   └── applications/
│       ├── Admission.tsx              ← /applications/admission (inbox list)
│       ├── AdmissionDetail.tsx        ← /applications/admission/:id (full page)
│       └── Enrollment.tsx             ← /applications/enrollment
│
├── components/
│   └── applications/
│       ├── ApplicationDetailPanel.tsx ← Tier 1: Sheet panel content
│       ├── ApplicationDetailFull.tsx  ← Tier 2: Full page tabs content
│       ├── ActionButtons.tsx          ← Status-conditional buttons
│       ├── StatusBadge.tsx            ← Status badge with color + label
│       ├── StatusTimeline.tsx         ← Audit log timeline display
│       ├── SCPAssessmentBlock.tsx     ← SCP-specific assessment details
│       ├── BeefSections/
│       │   ├── PersonalInfo.tsx       ← Collapsed BEEF section
│       │   ├── GuardianContact.tsx
│       │   ├── PreviousSchool.tsx
│       │   └── Classifications.tsx
│       └── dialogs/
│           ├── ApproveDialog.tsx      ← Section assignment dialog
│           ├── RejectDialog.tsx       ← Rejection with DO 017 reminder
│           ├── ScheduleExamDialog.tsx ← SCP exam scheduling
│           ├── RecordResultDialog.tsx ← SCP result recording (dynamic by assessmentType)
│           └── FailedDialog.tsx       ← Offer regular section or reject
│
└── hooks/
    └── useApplicationDetail.ts        ← GET /api/applications/:id + cache
```

---

## 9. Accessibility

| Requirement | Implementation |
|---|---|
| Panel focus management | On open: focus moves to the panel's first interactive element (the ✕ close button). On close: focus returns to the row that triggered the panel. |
| Escape key | Closes the panel. Standard `Sheet` behavior from shadcn/ui. |
| Keyboard nav within panel | Tab order: header close → summary block → collapsed sections → "View Full Details" → action buttons. |
| Status badge | `aria-label="Status: Pending"` — not just a visual badge. |
| Dialog trap | All action dialogs trap focus inside the dialog until dismissed. `Dialog` from shadcn/ui handles this. |
| SPI sensitive indicator | The `🔒 Sensitive` badge includes `aria-label="Contains sensitive personal information"`. |
| Screen reader | Panel uses `role="region"` with `aria-label="Application Detail for [learner name]"`. The BEEF sections use `<details>/<summary>` natively — no ARIA overrides needed. |
| Color not sole indicator | Status is communicated by text label + color — never color alone. A red FAILED badge also says "Failed" in text. |

---

## 10. shadcn/ui Implementation Reference

### Panel — Sheet

```tsx
// client/src/pages/applications/Admission.tsx
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ApplicationDetailPanel } from '@/components/applications/ApplicationDetailPanel';

export function Admission() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <div className="flex h-full overflow-hidden">

      {/* LEFT — Inbox list */}
      <div className={cn(
        'flex-1 overflow-auto transition-all duration-200',
        selectedId ? 'mr-[45%] min-mr-[480px]' : '',
      )}>
        <ApplicationList
          onRowClick={(id) => setSelectedId(id)}
          selectedId={selectedId}
        />
      </div>

      {/* RIGHT — Detail panel */}
      <Sheet
        open={selectedId !== null}
        onOpenChange={(open) => { if (!open) setSelectedId(null); }}
      >
        <SheetContent
          side="right"
          className="w-[45%] min-w-[480px] max-w-[640px] p-0 flex flex-col"
        >
          {selectedId && (
            <ApplicationDetailPanel
              id={selectedId}
              onClose={() => setSelectedId(null)}
            />
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}
```

### Action Buttons — Conditional Rendering

```tsx
// client/src/components/applications/ActionButtons.tsx
import { Button } from '@/components/ui/button';
import type { Applicant } from '@/types/applicant';

interface Props {
  applicant: Applicant;
  onApprove:         () => void;
  onReject:          () => void;
  onScheduleExam:    () => void;
  onRecordResult:    () => void;
  onPass:            () => void;
  onFail:            () => void;
  onOfferRegular:    () => void;
}

export function ActionButtons({ applicant, ...handlers }: Props) {
  const { status, applicantType } = applicant;
  const isRegular = applicantType === 'REGULAR';
  const isSCP     = !isRegular;

  return (
    <div className="flex flex-col gap-2 p-4 border-t bg-background">

      {isRegular && status === 'PENDING' && (
        <>
          <Button className="w-full" onClick={handlers.onApprove}>
            ✓ Approve &amp; Assign Section
          </Button>
          <Button variant="outline" className="w-full border-destructive text-destructive
            hover:bg-destructive hover:text-destructive-foreground"
            onClick={handlers.onReject}
          >
            ✗ Reject Application
          </Button>
        </>
      )}

      {isSCP && status === 'PENDING' && (
        <>
          <Button className="w-full" onClick={handlers.onScheduleExam}>
            📅 Verify &amp; Schedule Exam
          </Button>
          <Button variant="outline" className="w-full border-destructive text-destructive"
            onClick={handlers.onReject}
          >
            ✗ Reject Application
          </Button>
        </>
      )}

      {isSCP && status === 'EXAM_SCHEDULED' && (
        <Button className="w-full" onClick={handlers.onRecordResult}>
          📝 Record Assessment Result
        </Button>
      )}

      {isSCP && status === 'EXAM_TAKEN' && (
        <>
          <Button className="w-full" onClick={handlers.onPass}>
            ✅ Mark as Passed
          </Button>
          <Button variant="outline"
            className="w-full border-destructive text-destructive"
            onClick={handlers.onFail}
          >
            ❌ Mark as Failed
          </Button>
        </>
      )}

      {isSCP && status === 'PASSED' && (
        <Button className="w-full" onClick={handlers.onApprove}>
          ✅ Assign Section
        </Button>
      )}

      {isSCP && status === 'FAILED' && (
        <>
          <Button className="w-full" onClick={handlers.onOfferRegular}>
            🔄 Offer Regular Section
          </Button>
          <Button variant="outline"
            className="w-full border-destructive text-destructive"
            onClick={handlers.onReject}
          >
            ✗ Reject
          </Button>
        </>
      )}

      {(status === 'APPROVED' || status === 'ENROLLED' || status === 'REJECTED') && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No further actions available for this application.
        </p>
      )}

    </div>
  );
}
```

### Status Badge

```tsx
// client/src/components/applications/StatusBadge.tsx
import { Badge } from '@/components/ui/badge';

const CONFIG: Record<string, { label: string; className: string }> = {
  PENDING:        { label: 'Pending',        className: 'bg-amber-100 text-amber-800 border-amber-300' },
  EXAM_SCHEDULED: { label: 'Exam Scheduled', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  EXAM_TAKEN:     { label: 'Exam Taken',     className: 'bg-blue-100 text-blue-800 border-blue-300' },
  PASSED:         { label: 'Passed',         className: 'bg-green-100 text-green-800 border-green-300' },
  FAILED:         { label: 'Failed',         className: 'bg-red-100 text-red-800 border-red-300' },
  APPROVED:       { label: 'Approved',       className: 'bg-white text-green-700 border-green-500' },
  ENROLLED:       { label: 'Enrolled',       className: 'bg-green-500 text-white border-transparent' },
  REJECTED:       { label: 'Rejected',       className: 'bg-red-100 text-red-800 border-red-300' },
};

export function StatusBadge({ status }: { status: string }) {
  const { label, className } = CONFIG[status] ?? {
    label: status, className: 'bg-muted text-muted-foreground',
  };
  return (
    <Badge
      variant="outline"
      className={className}
      aria-label={`Status: ${label}`}
    >
      {label}
    </Badge>
  );
}
```

---

*Document v1.0.0*
*System: School Admission, Enrollment & Information Management System*
*Module: Enrollment Management — Applications → Admission*
*UI Pattern: Two-Tier — Right-Side Slide-over Panel (Tier 1) + Full Detail Page (Tier 2)*
*Components: shadcn/ui Sheet · Dialog · Tabs · Badge · Button · Card · Skeleton*
*Policy: DepEd Order No. 017, s. 2025 · RA 10173 (Data Privacy Act)*
