# Admission Form — UX/UI Specification
## School Admission, Enrollment & Information Management System

**Document Version:** 3.0.0
**Module:** Admission (Online + Face-to-Face)
**Routes:**
- `/apply` — public, unauthenticated (Online Admission)
- `/f2f-admission` — authenticated, role: REGISTRAR or SYSTEM_ADMIN (F2F Walk-in Admission)

**Components:**
- `client/src/pages/admission/Apply.tsx` (Online)
- `client/src/pages/admission/F2FAdmission.tsx` (F2F)

**Design System:** Instrument Sans · shadcn/ui · Tailwind CSS v4 · Sileo Toasts · Dynamic Accent Color
**Policy Basis:** RA 10173 · DO 017, s. 2025 · DM 012, s. 2026
**PRD Reference:** v3.0.0

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Two Admission Channels — Overview](#2-two-admission-channels--overview)
3. [Online Admission — Page Architecture](#3-online-admission--page-architecture)
4. [Wizard Step Structure](#4-wizard-step-structure)
5. [Phase 0 — Privacy Notice Gate](#5-phase-0--privacy-notice-gate)
6. [Step 1 — Personal Information](#6-step-1--personal-information)
7. [Step 2 — Family & Contact](#7-step-2--family--contact)
8. [Step 3 — Background & Classification](#8-step-3--background--classification)
9. [Step 4 — Previous School](#9-step-4--previous-school)
10. [Step 5 — Enrollment Preferences](#10-step-5--enrollment-preferences)
11. [Step 6 — Review & Submit](#11-step-6--review--submit)
12. [Success Screen](#12-success-screen)
13. [Closed State (`/closed`)](#13-closed-state-closed)
14. [F2F Walk-in Admission (`/f2f-admission`)](#14-f2f-walk-in-admission-f2f-admission)
15. [Component Specifications](#15-component-specifications)
16. [Validation Behavior & Error States](#16-validation-behavior--error-states)
17. [Responsive Behavior](#17-responsive-behavior)
18. [Accessibility Requirements](#18-accessibility-requirements)
19. [Performance Requirements](#19-performance-requirements)
20. [State Management](#20-state-management)
21. [Full File & Component Structure](#21-full-file--component-structure)
22. [Acceptance Criteria](#22-acceptance-criteria)

---

## 1. Design Principles

The admission form is the **first touchpoint** a student or parent has with the school's digital system. It must be trustworthy, clear, and forgiving. These principles govern every decision in this specification.

| Principle | What It Means in This Form |
|---|---|
| **One thing at a time** | Each wizard step covers one logical topic. Unrelated fields never share a step. |
| **Progressive disclosure** | Conditional fields appear only when triggered by a prior answer. |
| **Forgive first, validate second** | Inline validation fires on `onBlur`, not on every keystroke. The user completes their thought before being corrected. |
| **Never lose data** | All form state persists across step navigation. Going back to Step 1 does not clear Step 5. `sessionStorage` backs the form. |
| **Mobile is primary** | Every layout decision starts at 375px and scales up — never the reverse. |
| **Speak the user's language** | Labels use plain Filipino/English. "Mother's Full Name" — never `Parent_Guardian_Type: MOTHER`. |
| **The accent color is the school** | Every interactive element uses `var(--accent)`. When the school uploads their logo, both the online and F2F forms instantly become on-brand. School name in the header always comes from `SchoolSettings.schoolName`. |
| **Trust but verify** | The form never blocks a user due to optional fields. Required fields are marked with `*`. |
| **Two channels, one data model** | Online and F2F submissions produce identical `Applicant` records. The only difference is `admissionChannel` (ONLINE vs F2F) and `encodedById` (null vs registrar's user ID). |

---

## 2. Two Admission Channels — Overview

| Attribute | Online (`/apply`) | F2F Walk-in (`/f2f-admission`) |
|---|---|---|
| **Who fills the form** | Student / parent | Registrar (on behalf of walk-in applicant) |
| **Auth required** | No — public route | Yes — JWT, role: REGISTRAR or SYSTEM_ADMIN |
| **Enrollment gate check** | Yes — redirects to `/closed` when OFF | No — always accessible regardless of gate |
| **`admissionChannel` stored** | `ONLINE` | `F2F` |
| **`encodedById` stored** | `null` | Registrar's `User.id` |
| **Privacy consent** | Applicant checks box on screen | Registrar confirms physical consent checkbox ("applicant signed in person") |
| **Email delivery** | Always attempted to `emailAddress` | Attempted if `emailAddress` provided |
| **Tracking number display** | Prominent on-screen + emailed | On-screen (registrar prints or notes it) + emailed if address provided |
| **Fast-track option** | Not available | Registrar may set initial `status = APPROVED` at submission if documents are complete |
| **SCP conditional fields** | Show based on `applicantType` selection | Same — identical conditional logic |
| **Strand selection** | Shown for SHS grade levels only | Same — driven by configured strands for the selected grade level |

Both channels use identical form field sets, identical Zod validation schemas, and identical field ordering. The only UI-level differences are documented in §14.

---

## 3. Online Admission — Page Architecture

### 3.1 Overall Page Structure

The `/apply` page uses `GuestLayout` — no sidebar, no dashboard header. The entire viewport is the form.

```
VIEWPORT (any screen size)
│
├── GuestLayout wrapper
│   └── <Toaster position="top-center" />   ← Sileo, top-center for guest pages
│
└── Apply.tsx
    │
    ├── PAGE HEADER (sticky, full-width, light border-b)
    │   ├── School logo thumbnail (40×40px, rounded-full)
    │   │     — from settingsStore.logoUrl; shows <School /> icon if null
    │   ├── School name (font-semibold text-sm md:text-base)
    │   │     — from settingsStore.schoolName; NEVER a hardcoded string
    │   └── Academic year badge ("SY 2026–2027" from settingsStore.activeYear.yearLabel)
    │
    ├── FORM CARD (scrollable, centered, max-w-3xl)
    │   ├── Phase 0: Privacy Notice Gate  ← pre-step; all fields locked until consent
    │   ├── Step Progress Bar             ← Steps 1–6 (numbered dots + labels)
    │   ├── Step Content                  ← active step's fields
    │   └── Navigation Footer             ← Back · Next · Submit
    │
    └── PAGE FOOTER (minimal, full-width, border-t)
        └── "[School Name] · Online Admission Portal"
              — {settingsStore.schoolName} — no hardcoded school name
```

### 3.2 Form Card Sizing

| Breakpoint | Card Width | Padding | Field Layout |
|---|---|---|---|
| Mobile (≤ 767px) | `w-full` | `px-4 py-6` | Single column, full-width fields |
| Tablet (768–1023px) | `max-w-2xl mx-auto` | `px-8 py-8` | Single column |
| Desktop (≥ 1024px) | `max-w-3xl mx-auto` | `px-10 py-10` | Two-column grid for paired fields |
| Wide (≥ 1440px) | `max-w-3xl mx-auto` | Same | Same |

### 3.3 Page Background

```css
/* GuestLayout: off-white tinted backdrop behind the form card */
bg-muted/40

/* Form card: */
bg-white rounded-2xl shadow-sm border border-border
```

---

## 4. Wizard Step Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 0 — PRIVACY NOTICE GATE                                  │
│  Must scroll + consent before any field becomes interactive     │
└─────────────────┬───────────────────────────────────────────────┘
                  │ (after consent given)
                  ▼
  ●─────────○─────────○─────────○─────────○─────────○
  1         2         3         4         5         6
Personal  Family &  Background  Previous  Enrollment  Review &
 Info     Contact    & Class.    School   Preferences   Submit
```

**Step progress bar:**
- Completed steps: filled circle with checkmark, accent color
- Active step: filled circle, accent color, step number label bold
- Upcoming steps: empty circle, muted color

**Navigation footer:**
- Step 1: `[Next →]` only (no back on first step)
- Steps 2–5: `[← Back]` · `[Next →]`
- Step 6: `[← Back]` · `[Submit Application]`
- All primary buttons use `bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]`

---

## 5. Phase 0 — Privacy Notice Gate

**What it is:** A full-screen notice rendered before Step 1 that satisfies the RA 10173 requirement for informed, specific, freely given consent before collecting personal data.

**Layout:** Full-width, non-collapsible notice card. The applicant must scroll through it entirely before the consent checkbox becomes active.

**Notice content (renders dynamically from `settingsStore`):**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  🔒  DATA PRIVACY NOTICE                                                    │
│  Republic Act No. 10173 — Data Privacy Act of 2012                         │
│  ─────────────────────────────────────────────────────────────────────────  │
│  {schoolName}                                                               │
│  {division}                                                                 │
│  Department of Education — {region}                                         │
│                                                                             │
│  Why we collect your information                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│  The Department of Education (DepEd) and {schoolName} collect the           │
│  personal information on this form for the following specific and           │
│  legitimate purposes only:                                                  │
│                                                                             │
│  1. To process your child's admission and enrollment application.           │
│  2. To assign the learner to an appropriate grade level and section.        │
│  3. To issue or verify the Learner Reference Number (LRN).                  │
│  4. To upload data to the DepEd Learner Information System (LIS).           │
│  5. To communicate application status updates via the email provided.       │
│                                                                             │
│  Your rights under RA 10173                                                 │
│  You have the right to access, correct, object to processing, and          │
│  request erasure of your personal data at any time by contacting           │
│  {schoolName}.                                                              │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  ☐  I have read and understood this notice. I consent to the collection     │
│     and processing of the personal information I am about to provide.      │
│                                                                             │
│                          [ Begin Application ]                              │
└────────────────────────────────────────────────────────────────────────────┘
```

- All `{schoolName}`, `{division}`, `{region}` values are **runtime substitutions from `settingsStore`** — never hardcoded
- "Begin Application" button is **disabled** until the checkbox is checked
- Until consent is given, all step navigation is disabled
- Consent state is stored in `sessionStorage` so a browser refresh does not force re-consent within the same session

---

## 6. Step 1 — Personal Information

**Fields:**

| Field | Type | Required | Validation |
|---|---|---|---|
| Last Name | Text | ✅ | Min 2 chars; alpha + spaces + hyphens |
| First Name | Text | ✅ | Min 2 chars |
| Middle Name | Text | — | Optional |
| Suffix | Select | — | Jr · Sr · II · III · IV · None |
| Learner Reference Number (LRN) | Text | ✅ | Exactly 12 digits; not already enrolled in current AY |
| Date of Birth | Date picker | ✅ | Must be ≥ 10 years ago; ≤ 30 years ago |
| Sex | Radio | ✅ | Male / Female |
| Place of Birth | Text | — | |
| Nationality | Text | — | Default: "Filipino" |
| Religion | Text | — | |
| Mother Tongue | Text | — | |

**LRN lookup behavior:**
- On `onBlur` of the LRN field: calls `GET /api/applicants/check-lrn/:lrn`
- If LRN is already enrolled in the active academic year → inline error: "This LRN is already enrolled for SY [year]."
- If LRN exists from a prior year → auto-fills available fields (name, birthdate) with a confirmation toast: "We found a record for this LRN. Please verify the pre-filled details."
- If LRN is new → no action (proceed normally)

**Layout (desktop):** Two-column grid — Last Name / First Name · Middle Name / Suffix · (LRN full-width) · Date of Birth / Sex · Place of Birth / Nationality

---

## 7. Step 2 — Family & Contact

**Fields:**

| Field | Type | Required |
|---|---|---|
| Father's Full Name | Text | — |
| Father's Occupation | Text | — |
| Mother's Full Name | Text | — |
| Mother's Occupation | Text | — |
| Guardian's Full Name | Text | ✅ |
| Guardian's Relationship | Select | — |
| Guardian's Contact Number | Tel | ✅ |
| Email Address | Email | ✅ |
| Complete Address | Textarea | ✅ |
| Barangay | Text | — |
| Municipality / City | Text | — |
| Province | Text | — |

**Guardian relationship options:** Father · Mother · Grandmother · Grandfather · Aunt · Uncle · Sibling · Legal Guardian · Other

**Email validation:** Standard email format; used for tracking number delivery and status notifications.

---

## 8. Step 3 — Background & Classification

This step collects sensitive classifications required by DepEd for LIS data and resource planning.

**Fields:**

| Field | Type | Required | Conditional |
|---|---|---|---|
| Learner Type | Select | ✅ | Drives other fields below |
| Is Indigenous Peoples (IP) Learner? | Checkbox | — | If checked: show IP Community field |
| IP Community | Text | — | Only if IP = true |
| Is 4Ps Beneficiary? | Checkbox | — | If checked: show Household ID field |
| 4Ps Household ID | Text | — | Only if 4Ps = true |
| Is Learner with Disability (LWD)? | Checkbox | — | If checked: show Disability Type field |
| Disability Type | Select | — | Only if LWD = true |

**Learner type values:**
- New Enrollee (first time enrolling in this school)
- Transferee (from another school)
- Returning Learner (Balik-Aral)
- Continuing (from Grade 8–10 or Grade 12 — pre-registered)

**Disability type options:** Visual Impairment · Hearing Impairment · Learning Disability · Communication Disorder · Intellectual Disability · Physical / Orthopedic Disability · Multiple Disabilities · Other

**Sensitivity notice:** A small `ℹ️` tooltip on IP, 4Ps, and PWD fields reads: "This information is collected by DepEd solely for educational planning and resource allocation. It will not be shared beyond DepEd-authorized purposes."

---

## 9. Step 4 — Previous School

**Fields:**

| Field | Type | Required | Shown When |
|---|---|---|---|
| Last School Attended | Text | ✅ | Always |
| Last School Year | Text | — | Always |
| Last Grade Level Completed | Text | ✅ | Always |
| General Average (Last Grade) | Number | — | Always |
| Grade 10 Science Grade | Number | — | Only for STEM applicants (see Step 5) |
| Grade 10 Math Grade | Number | — | Only for STEM applicants (see Step 5) |

**Grade 10 Science/Math grades** are shown retroactively when the applicant returns to Step 4 after selecting the STEM strand in Step 5. They are validated to be between 0 and 100. If below 85, an amber advisory is shown (not a hard block): "DepEd's minimum requirement for STEM is 85 in both Science and Math in Grade 10."

---

## 10. Step 5 — Enrollment Preferences

This step is **fully dynamic** — all options are loaded from the active academic year configuration in the database. No grade level name, strand name, or SCP code is hardcoded in the frontend.

### Grade Level

```
Grade Level *
[ Dropdown loaded from GET /api/grade-levels — active AY only ]
```

Loading state: `<Skeleton className="h-10 w-full" />` while fetching.

### SCP Program (Shown when grade level is selected AND school has active SCP programs)

```
Are you applying for a Special Curricular Program (SCP)?
[ Dropdown loaded from GET /api/scp-programs?gradeLevelId={id} ]
  — "No, Regular Admission"
  — "STE — Science, Technology, Engineering"    (if configured)
  — "SPA — Special Program in the Arts"         (if configured)
  — (other SCPs the school has activated)
```

If the school has configured **zero SCP programs** for the selected grade level, this entire block is hidden. The applicant sees only the grade level and strand dropdowns. This is the correct behavior for schools that offer only regular admission.

### Strand (SHS only — shown when Grade 11 or Grade 12 is selected)

```
Track / Strand *
[ Dropdown loaded from GET /api/strands?gradeLevelId={id} ]
  e.g. Academic — STEM · Academic — ABM · Academic — HUMSS · TechPro — ICT
```

Strands are loaded dynamically from the active academic year. Schools that offer only JHS (no SHS) and have no configured strands will simply not see this field.

### SCP-Specific Conditional Fields

When the applicant selects an SCP program, additional fields appear based on the program's configured `assessmentType`:

| SCP Selected | Additional fields shown |
|---|---|
| STE | No extra fields (exam scheduled by registrar later) |
| SPA | Art Field (Select: Music · Dance · Visual Arts · Theater · Creative Writing · Media Arts) |
| SPS | Sport (Text field) |
| SPJ | No extra fields |
| SPFL | Foreign Language (Select from school-configured languages) |
| SPTVE | No extra fields |
| STEM (G11) | Grade 10 Science grade and Math grade (shown back in Step 4) |

---

## 11. Step 6 — Review & Submit

A read-only summary of all fields across all steps, organized in the same section groupings.

```
REVIEW YOUR APPLICATION

  ── PERSONAL INFORMATION ────────────────────────────────────────
  Name:          Dela Cruz, Juan Ramon
  LRN:           123456789012
  Date of Birth: March 15, 2012 (13 years old)
  Sex:           Male

  ── FAMILY & CONTACT ────────────────────────────────────────────
  Guardian:      Dela Cruz, Maria (Mother)
  Contact:       +63 912 345 6789
  Email:         jrdelacruz@gmail.com
  Address:       123 Rizal St., Brgy. San Jose, Kabankalan City, Negros Occidental

  ── PREVIOUS SCHOOL ─────────────────────────────────────────────
  Last School:   Kabankalan City Elementary School
  Last Grade:    Grade 6
  Average:       92.5

  ── ENROLLMENT PREFERENCE ───────────────────────────────────────
  Grade Level:   Grade 7
  Program:       Regular Admission

  [ ← Back to Edit ]   [ Submit Application ]
```

**Edit navigation:** "Back to Edit" returns to Step 1 with all data intact.

**Submit button behavior:**
- Single-click only — disabled after first click to prevent double-submission
- Shows a spinner: `[Submitting…]`
- On success: replace the form card with the Success Screen (§12)
- On error: re-enable the button; display a Sileo error toast with the server's error message

---

## 12. Success Screen

Replaces the form card upon successful submission. The form card is NOT unmounted (the same container shows this panel).

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   ✅   Application Submitted Successfully                        │
│                                                                  │
│   Thank you, Juan Ramon! Your application to                     │
│   {schoolName} for SY {yearLabel} has been received.            │
│                                                                  │
│   YOUR TRACKING NUMBER                                           │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │   APP-2026-00042                                         │   │
│   │                                        [ Copy Number ]  │   │
│   └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│   Save this number to track your application status.            │
│   A confirmation email has been sent to jrdelacruz@gmail.com.   │
│                                                                  │
│   What happens next?                                             │
│   The registrar will review your documents and notify you        │
│   via email once a decision has been made.                       │
│                                                                  │
│   [ Track My Application ]   [ Submit Another Application ]      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

- "Track My Application" links to `/track/{trackingNumber}`
- "Submit Another Application" clears the session storage and reloads the wizard from Phase 0
- `{schoolName}` and `{yearLabel}` are always from the settings store — never hardcoded

---

## 13. Closed State (`/closed`)

Shown when `enrollmentOpen = false`. The router loader redirects `/apply` to `/closed`.

```
┌──────────────────────────────────────────────────────────────────┐
│                  [School Logo]                                   │
│                  {schoolName}                                    │
│                                                                  │
│   📋   Online Enrollment Is Currently Closed                     │
│                                                                  │
│   The online admission portal for SY {yearLabel} is not yet      │
│   open. Please check back later or contact the school            │
│   registrar directly.                                            │
│                                                                  │
│   📍  {schoolName}                                               │
│                                                                  │
│   [ Track an Existing Application ]                              │
│                                                                  │
│   ───────────────────────────────────────────────────────────    │
│   Staff?  [ Staff Login ]     ← navigate('/login', { state: { loginAccess: true } })
└──────────────────────────────────────────────────────────────────┘
```

**"Staff Login" link is the Layer 1 injector** — it calls `navigate('/login', { state: { loginAccess: true } })`, which is the only way to reach the `/login` route from the public portal. Direct URL navigation to `/login` is blocked by the router loader (see PRD §9.1).

All `{schoolName}` and `{yearLabel}` values come from `settingsStore`.

---

## 14. F2F Walk-in Admission (`/f2f-admission`)

### 14.1 Overview

The F2F admission form is the **registrar's tool** for entering applications from students who walk in to the school office in person. It mirrors the online form exactly in field structure, validation rules, and SCP conditional logic. The registrar fills all fields on behalf of the applicant.

**Auth guard:** This route is wrapped in `<ProtectedRoute allowedRoles={['REGISTRAR', 'SYSTEM_ADMIN']}>`. Unauthenticated visitors are redirected to `/login` with `loginAccess: true`.

### 14.2 Page Layout

The F2F form sits inside `AppLayout` (with the sidebar). Unlike the online wizard, it renders as a **single scrollable form page** (not a multi-step wizard) because the registrar is working at a desk with full context and benefits more from a complete, reviewable layout than a step-by-step flow.

```
/f2f-admission
│
├── AppLayout (sidebar + header)
│   └── Page content area
│       │
│       ├── PAGE HEADER
│       │   ├── Heading: "Walk-in Admission"
│       │   ├── Breadcrumb: Dashboard → Walk-in Admission
│       │   └── Submission mode badge: "FACE-TO-FACE (F2F)"
│       │
│       └── FORM (scrollable, max-w-4xl)
│           ├── Section A: Personal Information
│           ├── Section B: Family & Contact
│           ├── Section C: Background & Classification
│           ├── Section D: Previous School
│           ├── Section E: Enrollment Preferences (dynamic — same as online)
│           ├── Section F: Privacy Consent Confirmation
│           └── FORM FOOTER
│               ├── [ Save as Pending ]    ← status = PENDING (default)
│               └── [ Save as Approved ]  ← status = APPROVED (documents verified on spot)
```

### 14.3 Differences from Online Form

**No wizard steps** — all sections on one scrollable page. The registrar can see the full form at once.

**Fast-track approval:** Two submit buttons at the bottom:
- "Save as Pending" — default; `status = PENDING`; registrar still needs to verify docs
- "Save as Approved" — available when documents are physically verified at the counter; `status = APPROVED`; registrar assigns section immediately in the next screen

**Privacy consent block (replaces Phase 0 gate):**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  PHYSICAL CONSENT CONFIRMATION                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│  ☐  The applicant / parent / guardian has physically signed the RA 10173   │
│     Data Privacy consent form and a copy has been retained on file.        │
│                                                                             │
│  (This field is required before this form can be submitted.)               │
└────────────────────────────────────────────────────────────────────────────┘
```

**Admission channel label:** A non-editable "Walk-in (F2F)" badge is always visible at the top of the form, clearly indicating the record will be stored with `admissionChannel: F2F`.

**Encoded by:** Populated automatically from the JWT (`req.user.userId`) — the registrar never fills this field. Not shown in the UI.

**Email field behavior:** If `emailAddress` is provided, a confirmation email is sent (same as online). If left blank, no email is sent and the registrar is expected to print or note the tracking number.

### 14.4 Section Layout

Because this is a full-page form for a desktop user, fields use a **two-column grid throughout** (`grid-cols-2 gap-4`), collapsing to single column on tablet (`sm:grid-cols-1`).

Section headings use `<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2 mb-4">`.

### 14.5 Enrollment Preferences Section (F2F)

The grade level dropdown, SCP program dropdown, and strand dropdown are **loaded from the same API endpoints as the online form**:
- `GET /api/grade-levels` (active AY)
- `GET /api/scp-programs?gradeLevelId={id}`
- `GET /api/strands?gradeLevelId={id}`

A school with no SCP programs sees no SCP field. A school with no strands configured sees no strand field. The behavior is identical to the online portal.

### 14.6 Submission

```typescript
// POST /api/applications/f2f
// Body: all Applicant fields + admissionChannel: 'F2F' (set by server) + encodedById (from JWT)

// Server side:
const applicant = await prisma.applicant.create({
  data: {
    ...validatedFields,
    admissionChannel: 'F2F',
    encodedById:      req.user.userId,   // registrar's user ID
    status:           req.body.saveAsApproved ? 'APPROVED' : 'PENDING',
    trackingNumber:   generateTrackingNumber(),
  }
});
```

On success: Sileo success toast with the tracking number. The form is cleared and the registrar can optionally be redirected to the new application's detail page via a toast action button.

---

## 15. Component Specifications

### `<StepIndicator>` (Online only)

```tsx
interface StepIndicatorProps {
  steps:       string[];   // Step labels
  currentStep: number;     // 1-indexed
}
```

Renders a horizontal row of numbered circles connected by lines. Completed steps show a `<CheckIcon />` in the filled accent circle. The active step shows the number in a filled accent circle with a ring. Future steps are empty circles with muted text.

### `<FormField>` (shared)

Wraps `<label>` + input/select/textarea + optional help text + error message. Consistent spacing and focus ring (`ring-[hsl(var(--accent-ring))]`).

### `<PrivacyNoticeGate>` (Online — Phase 0)

Renders the RA 10173 notice with `schoolName`, `division`, and `region` from props (sourced from `settingsStore`). Emits `onConsentGiven()` callback when the user checks the box and clicks "Begin Application."

### `<F2FConsentBlock>` (F2F only)

Single checkbox confirming physical signature. Blocks form submission until checked.

### `<TrackingNumberDisplay>` (Success Screen)

Renders the tracking number in a monospace, high-contrast box with a `[Copy]` button that calls `navigator.clipboard.writeText()`.

---

## 16. Validation Behavior & Error States

### Field-Level Validation

- Fires on `onBlur` (not on every keystroke)
- Error message appears below the field in `text-xs text-destructive`
- Field border changes to `border-destructive` (red) when invalid
- Error clears immediately when the user corrects the value

### Step-Level Validation (Online form)

- "Next" button click triggers validation for all fields in the current step
- If any field is invalid, scroll to the first invalid field and focus it
- Step navigation is blocked until all required fields in the current step are valid

### Form-Level Validation (F2F form)

- "Save" button click triggers `handleSubmit` from React Hook Form
- All validation runs at once; first invalid field is scrolled to and focused
- The form is validated against a Zod schema identical to the one used on the backend

### LRN Uniqueness Check

```typescript
// Fires on onBlur of the LRN field
const checkLrn = async (lrn: string) => {
  if (lrn.length !== 12) return;  // Only check when fully entered
  const { data } = await api.get(`/applicants/check-lrn/${lrn}`);
  if (data.alreadyEnrolled) {
    setError('lrn', { message: `This LRN is already enrolled for SY ${data.yearLabel}.` });
  } else if (data.existingApplicant) {
    // Pre-fill available fields and show confirmation toast
    setValue('lastName',  data.existingApplicant.lastName);
    setValue('firstName', data.existingApplicant.firstName);
    toast.info('We found an existing record for this LRN. Please verify the pre-filled details.');
  }
};
```

### Zod Schema (abbreviated)

```typescript
// client/src/validators/admissionSchema.ts
// Used by BOTH Apply.tsx (online) and F2FAdmission.tsx
export const admissionSchema = z.object({
  lrn:          z.string().regex(/^\d{12}$/, 'LRN must be exactly 12 digits'),
  lastName:     z.string().min(2, 'Last name is required'),
  firstName:    z.string().min(2, 'First name is required'),
  birthDate:    z.string().refine(d => isValidAge(d, 10, 30), 'Invalid date of birth'),
  sex:          z.enum(['MALE', 'FEMALE']),
  guardianName: z.string().min(2, 'Guardian name is required'),
  guardianContact: z.string().min(10, 'Valid contact number required'),
  emailAddress: z.string().email('Valid email address required'),
  address:      z.string().min(5, 'Complete address is required'),
  gradeLevelId: z.number({ required_error: 'Grade level is required' }),
  // ... SCP fields are conditionally required via .superRefine()
});
```

---

## 17. Responsive Behavior

### Online Form

| Breakpoint | Step indicator | Field columns | Navigation footer |
|---|---|---|---|
| `< sm` (375px) | Horizontal scroll with visible current step only | 1 column | Stacked (Back above Next) |
| `sm` (640px) | All steps visible | 1 column | Side by side |
| `md` (768px) | All steps with labels | 1 column | Side by side |
| `lg` (1024px) | All steps with full labels | 2 columns for paired fields | Side by side |

### F2F Form

| Breakpoint | Layout |
|---|---|
| `< md` | Single column (sidebar closed) |
| `md` | 2-column grid within each section |
| `lg` | 2-column grid, wider max-w-4xl |

---

## 18. Accessibility Requirements

| Requirement | Implementation |
|---|---|
| All form fields have associated `<label>` | Via `htmlFor` + `id` pairing on every `<FormField>` |
| Error messages linked to fields | `aria-describedby` pointing to the error `<p>` id |
| Required fields marked | `aria-required="true"` + visual `*` in label |
| Focus management on step change | `focus()` called on the first field of the new step after transition |
| Color not the only error indicator | Error state: border + text + icon, not color alone |
| Keyboard navigable | All interactive elements reachable via Tab; dropdowns keyboard-navigable via shadcn/ui Select |
| Step progress readable by screen readers | `aria-label` on step dots: `"Step 2 of 6: Family & Contact. Completed."` |
| Consent checkbox labeled | `htmlFor` on the RA 10173 consent checkbox |

---

## 19. Performance Requirements

| Requirement | Target | How |
|---|---|---|
| Time to First Contentful Paint | < 1.5s | School name and logo cached in `settingsStore`; form renders immediately |
| API calls on load | ≤ 2 | `GET /api/settings/public` (settings + color) + `GET /api/grade-levels` (prefetched) |
| Step navigation | < 100ms | No API calls between steps; state is local |
| LRN check debounce | 300ms after `onBlur` | Avoids redundant checks on partial input |
| Grade level → SCP/strand fetch | < 500ms | Triggered once when grade level changes |
| Bundle size | React Hook Form + Zod + Axios | No additional form library or schema library |
| `sessionStorage` write | After every step | Prevents data loss on accidental refresh |

---

## 20. State Management

### Online Form State

```typescript
// client/src/pages/admission/Apply.tsx
// All form state is managed by React Hook Form with defaultValues pre-hydrated
// from sessionStorage on mount.

interface AdmissionFormState {
  // Phase 0
  consentGiven: boolean;

  // Step 1 — Personal Info
  lrn: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  suffix?: string;
  birthDate: string;
  sex: 'MALE' | 'FEMALE';
  birthPlace?: string;
  nationality?: string;
  religion?: string;
  motherTongue?: string;

  // Step 2 — Family & Contact
  fatherName?: string;
  fatherOccupation?: string;
  motherName?: string;
  motherOccupation?: string;
  guardianName: string;
  guardianRelationship?: string;
  guardianContact: string;
  emailAddress: string;
  address: string;
  barangay?: string;
  municipality?: string;
  province?: string;

  // Step 3 — Classifications
  learnerType: string;
  isIndigenousPeople: boolean;
  ipCommunity?: string;
  is4PsBeneficiary: boolean;
  householdId?: string;
  isPersonWithDisability: boolean;
  disabilityType?: string;

  // Step 4 — Previous School
  lastSchoolAttended: string;
  lastSchoolYear?: string;
  lastGradeCompleted: string;
  generalAverage?: number;
  grade10ScienceGrade?: number;
  grade10MathGrade?: number;

  // Step 5 — Enrollment Preferences
  gradeLevelId: number;
  applicantType: string;
  scpProgramCode?: string;
  strandId?: number;
  artField?: string;
  sport?: string;
  foreignLanguage?: string;
}

// sessionStorage key
const SESSION_KEY = 'admission_form_draft';

// Load on mount
const saved = sessionStorage.getItem(SESSION_KEY);
const defaultValues = saved ? JSON.parse(saved) : {};

// Save after every change
useEffect(() => {
  const subscription = watch((values) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(values));
  });
  return () => subscription.unsubscribe();
}, [watch]);

// Clear on successful submission
sessionStorage.removeItem(SESSION_KEY);
```

### F2F Form State

The F2F form uses React Hook Form with the same `AdmissionFormState` interface. No `sessionStorage` persistence is needed — the registrar is working at a desk and won't accidentally refresh the page. If the form is cleared, a confirmation dialog warns: "You have unsaved data. Are you sure you want to clear the form?"

---

## 21. Full File & Component Structure

```
client/src/
├── pages/
│   └── admission/
│       ├── Apply.tsx                     ← Online admission wizard
│       ├── F2FAdmission.tsx              ← F2F form (registrar)
│       ├── TrackApplication.tsx          ← Status tracker by tracking number
│       └── EnrollmentClosed.tsx          ← /closed page
│
├── components/
│   └── admission/
│       ├── StepIndicator.tsx             ← Progress dots (online wizard)
│       ├── PrivacyNoticeGate.tsx         ← Phase 0 consent wall (online)
│       ├── F2FConsentBlock.tsx           ← Physical consent checkbox (F2F)
│       ├── TrackingNumberDisplay.tsx     ← Success screen tracking box
│       ├── GradeLevelSelect.tsx          ← Shared — loads from API
│       ├── ScpProgramSelect.tsx          ← Shared — conditional; loads from API
│       ├── StrandSelect.tsx              ← Shared — conditional; loads from API
│       └── ScpConditionalFields.tsx      ← Shared — shows art/sport/language field
│
└── validators/
    └── admissionSchema.ts                ← Shared Zod schema (online + F2F)
```

**Key rule:** `GradeLevelSelect`, `ScpProgramSelect`, `StrandSelect`, and `ScpConditionalFields` are shared between `Apply.tsx` and `F2FAdmission.tsx`. Any change to how these dropdowns behave applies to both channels simultaneously.

---

## 22. Acceptance Criteria

| # | Channel | Test |
|---|---|---|
| AC-01 | Online | Guest submits the form and receives a tracking number on screen and via email. |
| AC-02 | Online | `/apply` redirects to `/closed` when `enrollmentOpen = false`. |
| AC-03 | Online | Phase 0 consent checkbox is disabled until the user has scrolled to the bottom of the notice. |
| AC-04 | Online | "Begin Application" is disabled until Phase 0 consent is checked. |
| AC-05 | Online | Clicking "Next" without filling required fields displays inline error messages; step does not advance. |
| AC-06 | Online | Going back to Step 1 from Step 5 does not clear any previously entered data. |
| AC-07 | Online | LRN field shows a pre-fill toast when a returning LRN is entered. |
| AC-08 | Online | LRN field shows an error when the LRN is already enrolled in the current AY. |
| AC-09 | Both | SCP program dropdown is hidden when no SCP programs are configured for the selected grade level. |
| AC-10 | Both | Strand dropdown is hidden for non-SHS grade levels. |
| AC-11 | Both | Art field appears when SPA is selected; sport field appears when SPS is selected. |
| AC-12 | Both | School name in the page header, success screen, and privacy notice comes from `settingsStore.schoolName` — never hardcoded. |
| AC-13 | F2F | `/f2f-admission` is accessible by REGISTRAR and SYSTEM_ADMIN regardless of `enrollmentOpen` state. |
| AC-14 | F2F | Unauthenticated user navigating to `/f2f-admission` is redirected to `/login` with `loginAccess: true`. |
| AC-15 | F2F | Submission stores `admissionChannel: F2F` and `encodedById` = the registrar's user ID. |
| AC-16 | F2F | "Save as Approved" button sets `status = APPROVED` in the created record. |
| AC-17 | F2F | The physical consent checkbox is required before either submit button is active. |
| AC-18 | Both | All buttons, focus rings, and step indicators use `var(--accent)` — they change when the school uploads a new logo. |
| AC-19 | Both | The form is fully usable at 375px with no horizontal overflow. |
| AC-20 | Both | No `alert()` or `confirm()` dialogs are used — all feedback is via Sileo toasts. |

---

*Document v3.0.0*
*Module: Admission (Online + Face-to-Face)*
*System: School Admission, Enrollment & Information Management System*
*Stack: PERN (PostgreSQL 18 · Express.js 5.1 · React 19.x · Node.js 22 LTS)*
*Design: School-agnostic — all school-specific text and colors are runtime-configurable*