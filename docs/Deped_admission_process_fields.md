# DepEd Admission Process Fields
## Complete BEEF Field Reference & System Implementation Guide

**Document Version:** 3.0.0
**System:** School Admission, Enrollment & Information Management System
**Policy Basis:** DepEd Order No. 017, s. 2025 · RA 10173 (Data Privacy Act) · DM 149, s. 2011 · DM 012, s. 2026
**Applies To:** Online Admission (`/apply`) · F2F Admission (`/f2f-admission`) · Enrollment Management (`/applications`) · SIMS (`/students`) · Teacher Management (`/teachers`) · Grade Level & Sectioning (`/sections`)

> **Dynamic rule enforced system-wide:** All school-identifying text (school name, division, region) is sourced from `SchoolSettings` at runtime. Grade levels, strands, and SCP options in every form, dropdown, and filter across all modules are loaded from the active academic year's database configuration. Nothing is hardcoded.

---

## Table of Contents

1. [RA 10173 — Data Privacy Notice](#1-ra-10173--data-privacy-notice)
2. [Two Admission Pathways](#2-two-admission-pathways)
3. [The Basic Education Enrollment Form (BEEF)](#3-the-basic-education-enrollment-form-beef)
   - 3.1 [Section 1 — School Year & LRN](#31-section-1--school-year--lrn)
   - 3.2 [Section 2 — Grade Level & Program](#32-section-2--grade-level--program)
   - 3.3 [Section 3 — Personal Information](#33-section-3--personal-information)
   - 3.4 [Section 4 — Special Classifications](#34-section-4--special-classifications)
   - 3.5 [Section 5 — Address](#35-section-5--address)
   - 3.6 [Section 6 — Parent / Guardian Information](#36-section-6--parent--guardian-information)
   - 3.7 [Section 7 — Previous School](#37-section-7--previous-school)
   - 3.8 [Section 8 — SHS Track & Cluster](#38-section-8--shs-track--cluster)
   - 3.9 [Section 9 — Learner Type & Modality](#39-section-9--learner-type--modality)
   - 3.10 [Section 10 — Certification & Consent](#310-section-10--certification--consent)
4. [Complete Field Reference Table](#4-complete-field-reference-table)
5. [SCP-Specific Additional Fields](#5-scp-specific-additional-fields)
6. [F2F Admission — Field Differences](#6-f2f-admission--field-differences)
7. [Validation Rules](#7-validation-rules)
8. [Prisma Model Mapping](#8-prisma-model-mapping)
9. [Data Privacy & Sensitive Field Handling](#9-data-privacy--sensitive-field-handling)
10. [System Design Notes — All Five Modules](#10-system-design-notes--all-five-modules)

---

## 1. RA 10173 — Data Privacy Notice

The Data Privacy Notice is the **first element rendered** on both `/apply` and `/f2f-admission`. No form field is visible or interactive until consent is confirmed.

### 1.1 Privacy Notice — Full Text (Template)

All `[SchoolSettings.schoolName]`, `[SchoolSettings.division]`, and `[SchoolSettings.region]` values are substituted at runtime. The notice uses brackets to mark dynamic values — there is no hardcoded school name, division, or region anywhere in the codebase.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🔒  DATA PRIVACY NOTICE                                                 │
│  Republic Act No. 10173 — Data Privacy Act of 2012                      │
│  National Privacy Commission Advisory Opinions                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  [SchoolSettings.schoolName]                                             │
│  [SchoolSettings.division]                                               │
│  Department of Education — [SchoolSettings.region]                      │
│                                                                          │
│  Why we collect your information                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  The Department of Education (DepEd) and [SchoolSettings.schoolName]    │
│  collect the personal information on this form for the following         │
│  specific and legitimate purposes only:                                  │
│                                                                          │
│    1. To process your child's admission and enrollment application.      │
│    2. To assign the learner to a grade level, section, and program.     │
│    3. To encode the learner's profile into the DepEd Learner             │
│       Information System (LIS) as required by national policy.          │
│    4. To communicate with you regarding your child's application         │
│       status, exam schedules, and enrollment confirmation.               │
│    5. To comply with DepEd reporting requirements to the SDO.           │
│    6. To tag equity program beneficiaries for appropriate support.       │
│                                                                          │
│  What information we collect                                             │
│  ─────────────────────────────────────────────────────────────────────  │
│  Personal Information:                                                   │
│    • Full name, date of birth, sex, place of birth                       │
│    • Home address · Mother tongue · Religion · LRN                       │
│  Sensitive Personal Information:                                         │
│    • Disability status and type (if applicable)                          │
│    • Indigenous Peoples (IP) cultural community affiliation              │
│    • 4Ps Pantawid Pamilyang Pilipino Program beneficiary status          │
│    • Grade 10 subject grades (for applicable SCP applicants only)       │
│  Contact Information:                                                    │
│    • Parent/guardian name, contact number, and email address             │
│                                                                          │
│  Your rights under RA 10173                                              │
│  ─────────────────────────────────────────────────────────────────────  │
│    ✓ Be informed   ✓ Access   ✓ Rectification                            │
│    ✓ Object        ✓ Erasure / Blocking   ✓ Damages                     │
│    ✓ File a complaint with the NPC (privacy.gov.ph)                     │
│                                                                          │
│  Data Privacy Officer Contact                                            │
│  ─────────────────────────────────────────────────────────────────────  │
│  [SchoolSettings.schoolName] Registrar's Office                         │
│  National Privacy Commission: privacy.gov.ph · info@privacy.gov.ph      │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│  ☐  I have read and I agree to the Data Privacy Notice above.  *        │
│     (This field is required to proceed.)                                │
│                                                                          │
│  [ Proceed to Application Form → ]   ← disabled until checked          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Consent Implementation

**Scroll-to-read enforcement:** The checkbox is disabled until the user scrolls to the bottom of the notice box.

```tsx
// client/src/components/admission/PrivacyNoticeGate.tsx
const handleNoticeScroll = (e: React.UIEvent<HTMLDivElement>) => {
  const el = e.currentTarget;
  const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 10;
  if (atBottom) setHasScrolledNotice(true);
};
```

**State machine:**
```
hasScrolledNotice = false  →  checkbox disabled (opacity-50, pointer-events-none)
hasScrolledNotice = true   →  checkbox enabled
consentChecked    = false  →  "Proceed" button disabled
consentChecked    = true   →  "Proceed" button active (school accent color via var(--accent))
```

**Audit trail fields stored on the `Applicant` record:**

```prisma
privacyConsentGiven     Boolean   @default(false)
privacyConsentTimestamp DateTime?
privacyConsentVersion   String?   // e.g. "RA10173-v2025-DO017"
```

**F2F difference:** On `/f2f-admission` the notice appears in a condensed block. The registrar checks: *"The applicant / parent / guardian has physically signed the RA 10173 Data Privacy consent form and a copy has been retained on file."*

### 1.3 Lawful Basis per Data Category (RA 10173 §12 / §13)

| Data Category | Lawful Basis |
|---|---|
| Learner identity (name, birthdate, sex, LRN) | DepEd's constitutional mandate (RA 10533); government function |
| Address | School district assignment; emergency contact — government function |
| Mother tongue | MTB-MLE program requirement — government function |
| Religion | Values class scheduling — optional; no adverse effect if blank |
| Family contact | Communication re enrollment and exam schedules — necessary for stated purpose |
| **Disability status (SPI)** | SNEd/SPED referral and accommodation — explicit consent required |
| **IP affiliation (SPI)** | IPEd program tagging — explicit consent + additional safeguards |
| **4Ps status and Household ID (SPI)** | DSWD-DepEd coordination — strict access control |
| Grade 10 grades | Collected **only** for applicable SCP applicants — data minimization principle |
| SCP assessment scores | Collected only for SCP applicants; retained in SIMS after enrollment |

---

## 2. Two Admission Pathways

### Path A — Online Admission (`/apply`)

- Public, unauthenticated — no login required
- **Gate:** React Router loader redirects to `/closed` when `enrollmentOpen = false`
- `admissionChannel: ONLINE` stored on the `Applicant` record
- Privacy consent captured on-screen before any field is accessible

### Path B — F2F Walk-in Admission (`/f2f-admission`)

- Requires JWT authentication — role: REGISTRAR or SYSTEM_ADMIN
- **Never gated by the enrollment gate** — always accessible to authorized staff
- `admissionChannel: F2F` and `encodedById: <registrar userId>` stored
- Registrar confirms physical consent signature checkbox
- Same validation rules and SCP conditional fields apply as Path A

Both pathways produce an identical `Applicant` record in the database. The only differences are `admissionChannel`, `encodedById`, and the initial `status` (F2F may be set to `APPROVED` immediately if documents are verified on the spot).

---

## 3. The Basic Education Enrollment Form (BEEF)

The BEEF is the official DepEd enrollment document under DO 017, s. 2025. The system's admission form captures all relevant BEEF sections. Sections that apply only to lower grade levels (Kindergarten, Grades 1–6) are omitted — this system serves secondary schools (Grades 7–12) only.

### 3.1 Section 1 — School Year & LRN

| # | Field | Type | Required | Notes |
|---|---|---|---|---|
| 1.1 | School Year | Auto-filled | ✅ | Set from active `AcademicYear.yearLabel` — not editable by applicant |
| 1.2 | Learner Reference Number (LRN) | Text (12 digits) | ✅ | Unique system-wide; checked against existing records on blur |
| 1.3 | PSA Birth Certificate Number | Text | If available | Once-only submission; stored for LIS reference; never logged in plaintext |

**LRN on-blur behavior:**
- Calls `GET /api/applicants/check-lrn/:lrn`
- Already enrolled in active AY → inline error: "This LRN is already enrolled for SY [year]."
- Exists from prior year → pre-fills name and birthdate with a confirmation toast
- New → proceed normally

---

### 3.2 Section 2 — Grade Level & Program

| # | Field | Type | Required | Notes |
|---|---|---|---|---|
| 2.1 | Grade Level | Select | ✅ | **Loaded dynamically from `GET /api/grade-levels`** — active AY only; never hardcoded |
| 2.2 | SCP Application | Select | Conditional | Shown only when active SCP programs exist for the selected grade level; loaded from `GET /api/scp-programs?gradeLevelId=` |
| 2.3 | SHS Track | Radio | Grade 11 | Academic / TechPro — shown only when Grade 11 selected |
| 2.4 | Elective Cluster | Select | Grade 11 | **Loaded from `GET /api/strands?gradeLevelId=`** — school-configured; never hardcoded |

> **School-agnostic rule:** A school that offers no SHS strands will see no strand field. A school that offers no SCP programs will see no SCP dropdown. These are not feature flags — they follow directly from what is configured in Settings Tab 3.

---

### 3.3 Section 3 — Personal Information

| # | Field | Type | Required | Validation |
|---|---|---|---|---|
| 3.1 | Last Name | Text | ✅ | Min 2 chars; letters, spaces, hyphens; Filipino accented chars (ñ, á, etc.) allowed |
| 3.2 | First Name | Text | ✅ | Same as last name |
| 3.3 | Middle Name | Text | — | Optional; "N/A" accepted |
| 3.4 | Extension Name (Suffix) | Select | — | Jr. · Sr. · II · III · IV · N/A |
| 3.5 | Date of Birth | Date picker | ✅ | Valid calendar date; Grade 7 learner ≥ 10 years old; Grade 11 ≥ 14 years old |
| 3.6 | Sex | Radio | ✅ | Male / Female — per PSA Birth Certificate; DepEd uses binary classification |
| 3.7 | Place of Birth | Text | — | City/Municipality, Province |
| 3.8 | Nationality | Text | — | Default: "Filipino" |
| 3.9 | Religion | Text | — | Free text; optional |
| 3.10 | Mother Tongue | Text | — | First language learned at home |

> These fields collect **Personal Information (PI)** under RA 10173. All are included in the online and F2F forms.

---

### 3.4 Section 4 — Special Classifications

These fields are for equity program tagging and inclusion services. A "Yes" answer triggers additional support services — **not disqualification from enrollment**.

| # | Field | Type | Required | Follow-up |
|---|---|---|---|---|
| 4.1 | Belonging to an IP Cultural Community? | Checkbox | — | If Yes → IP Community name (free text) |
| 4.2 | 4Ps Beneficiary? | Checkbox | — | If Yes → 4Ps Household ID (numeric) |
| 4.3 | Learner with Disability (LWD)? | Checkbox | — | If Yes → Disability Type (multi-select) |
| 4.4 | Disability Type | Multi-select | Conditional | Visual Impairment · Hearing Impairment · Physical/Motor · Intellectual · Learning · Speech/Language · Emotional/Behavioral · Autism Spectrum · Multiple · Other |

> These fields collect **Sensitive Personal Information (SPI)** under RA 10173. Access in SIMS is restricted to REGISTRAR and SYSTEM_ADMIN only. SPI fields are **never included in paginated list API responses** — they are returned only on single-record detail views.

---

### 3.5 Section 5 — Address

**Current Address:**

| # | Field | Required |
|---|---|---|
| 5.1 | House No. / Street | — |
| 5.2 | Barangay | ✅ |
| 5.3 | City / Municipality | ✅ |
| 5.4 | Province | ✅ |
| 5.5 | Country | — (default: Philippines) |

**Permanent Address:** A checkbox "Same as Current Address" reveals a duplicate set of fields when unchecked.

---

### 3.6 Section 6 — Parent / Guardian Information

| Group | Key Fields | Required |
|---|---|---|
| Mother | Full name, contact number | — (required if primary contact) |
| Father | Full name, contact number | — (required if primary contact) |
| Legal Guardian | Full name, relationship, contact number | ✅ (at least one guardian contact required) |
| Email Address | Parent/guardian email | ✅ (online) · Optional (F2F) |

> Email is used for tracking number delivery and all status notifications. Contact numbers and emails are collected under the stated purpose of school communication only — RA 10173 prohibits sharing these with third parties.

---

### 3.7 Section 7 — Previous School

| # | Field | Required |
|---|---|---|
| 7.1 | Last School Attended (full name) | ✅ |
| 7.2 | DepEd School ID of sending school | — |
| 7.3 | Last Grade Level Completed | ✅ |
| 7.4 | School Year Last Attended | — |
| 7.5 | General Average (last grade) | — |

General average is stored in `Applicant.generalAverage` and displayed in the SIMS profile's Academic History tab.

---

### 3.8 Section 8 — SHS Track & Cluster

> **Conditionally shown only** when the selected grade level has strands configured for the active academic year. Hidden for JHS-only schools and for all non-SHS grade level selections.

**For Grade 11 (new entrants under DM 012, s. 2026):**

| # | Field | Required |
|---|---|---|
| 8.1 | SHS Track | ✅ — Academic / TechPro |
| 8.2 | Elective Cluster | ✅ — loaded from configured strands |
| 8.3 | Grade 10 Science Grade | Required if STEM cluster selected |
| 8.4 | Grade 10 Mathematics Grade | Required if STEM cluster selected |

**For Grade 12 transferees (old strand system — SY 2026–2027 transition):**
These students are continuing under the pre-DM012 strand classification (STEM, ABM, HUMSS, GAS, TVL variants). The system should show the old strand selector for Grade 12 transferees only.

> **Clusters are not hardcoded.** The elective cluster dropdown loads from `GET /api/strands?gradeLevelId=` — only the clusters the school has configured for the active academic year are shown.

---

### 3.9 Section 9 — Learner Type & Modality

| # | Field | Required | Options |
|---|---|---|---|
| 9.1 | Type of Learner | ✅ | New Enrollee · Transferee · Returning (Balik-Aral) · Continuing · OSCYA |
| 9.2 | Preferred Learning Modality | — | Face-to-Face · Blended · Distance Modular · Online · Home Schooling |

---

### 3.10 Section 10 — Certification & Consent

The final step of the admission form. On the **digital portal**:

```
┌──────────────────────────────────────────────────────────────┐
│  ✓ Accuracy Certification                                    │
│                                                              │
│  ☐  I certify that all information I have provided on        │
│     this form is true, correct, and complete to the best    │
│     of my knowledge and belief.  *                          │
│                                                              │
│  Full Name of Parent / Guardian (or Learner if 18+) *        │
│  [ _________________________________ ]                       │
│                                                              │
│  Date  *    [ auto-filled: today ]                           │
│                                                              │
│  (Your Data Privacy consent was recorded at the start of     │
│   this form on [privacyConsentTimestamp]. ✓)                 │
│                                                              │
│              [ ← Back ]    [ Submit Application → ]         │
└──────────────────────────────────────────────────────────────┘
```

The privacy consent timestamp display confirms the consent was captured in Phase 0 — no re-consent required at this step.

---

## 4. Complete Field Reference Table

Summary master table of every BEEF field captured in this system:

| Section | # | Field | Type | Required | G7 | G11 | Transferee |
|---|---|---|---|---|---|---|---|
| **1 Reference** | 1.2 | LRN | Numeric (12) | ✅ | ✓ | ✓ | ✓ |
| | 1.3 | PSA BC Number | Text | If available | ✓ | ✓ | ✓ |
| **2 Grade/Program** | 2.1 | Grade Level | Select | ✅ | ✓ | ✓ | ✓ |
| | 2.2 | SCP Application | Select | Conditional | ✓ | — | — |
| | 2.3 | SHS Track | Radio | G11 | — | ✓ | ✓ (G11) |
| | 2.4 | Elective Cluster | Select | G11 | — | ✓ | ✓ (G11) |
| **3 Personal** | 3.1–3.2 | Last + First Name | Text | ✅ | ✓ | ✓ | ✓ |
| | 3.3–3.4 | Middle + Suffix | Text | — | ✓ | ✓ | ✓ |
| | 3.5 | Date of Birth | Date | ✅ | ✓ | ✓ | ✓ |
| | 3.6 | Sex | Radio | ✅ | ✓ | ✓ | ✓ |
| | 3.7–3.10 | Birth place, Nationality, Religion, Mother Tongue | Text | — | ✓ | ✓ | ✓ |
| **4 Classification** | 4.1 | IP Status | Checkbox | — | ✓ | ✓ | ✓ |
| | 4.2 | 4Ps Status | Checkbox | — | ✓ | ✓ | ✓ |
| | 4.3–4.4 | LWD + Disability Type | Checkbox + Select | — | ✓ | ✓ | ✓ |
| **5 Address** | 5.1–5.5 | Current Address | Text | ✅ (barangay+) | ✓ | ✓ | ✓ |
| **6 Guardian** | 6.1–6.14 | Mother/Father/Guardian | Text | ✅ (guardian) | ✓ | ✓ | ✓ |
| | 6.15 | Email | Email | ✅ (online) | ✓ | ✓ | ✓ |
| **7 Previous School** | 7.1–7.5 | School, Grade, SY, Average | Text | ✅ (school+grade) | ✓ | ✓ | ✓ |
| **8 SHS** | 8.3–8.4 | G10 Science + Math grades | Number | STEM only | — | ✓ | ✓ (G11) |
| **9 Learner Type** | 9.1 | Learner Type | Select | ✅ | ✓ | ✓ | ✓ |
| | 9.2 | SCP Selection | Select | Conditional | ✓ | — | — |

---

## 5. SCP-Specific Additional Fields

These fields are only collected for SCP applicants. They are **conditionally shown** based on `applicantType` and the SCP program's configured `assessmentType`. They are not hardcoded — the system reads from the `ScpProgram.assessmentType` field to decide which fields to show.

### 5.1 Fields Present on the Admission Form (Step 5)

| SCP | Additional Field | Label | `Applicant` Field |
|---|---|---|---|
| SPA | Art field preference | Art Field | `artField` |
| SPS | Sport preference | Sport / Discipline | `sport` |
| SPFL | Foreign language preference | Foreign Language | `foreignLanguage` |
| STEM G11 | Grade 10 Science grade | Grade 10 Science Final Grade | `grade10ScienceGrade` |
| STEM G11 | Grade 10 Mathematics grade | Grade 10 Mathematics Final Grade | `grade10MathGrade` |

> STEM grade fields appear retroactively when the applicant goes back to Step 4 after selecting the STEM strand in Step 5. Both fields are required for STEM applicants. A warning (not a hard block) is shown if either grade is below 85.

### 5.2 Fields Filled by the Registrar (in `/applications`, not by the applicant)

| Field | Label | `Applicant` Field | When Set |
|---|---|---|---|
| Assessment Date | `examDate` | `examDate` | When registrar schedules via PATCH `/schedule-exam` |
| Assessment Type | `assessmentType` | `assessmentType` | Set automatically from `ScpProgram.assessmentType` |
| Assessment Score | `examScore` | `examScore` | After assessment, via PATCH `/record-result` |
| Exam Result | `examResult` | `examResult` | PASSED / FAILED |
| Exam Notes | `examNotes` | `examNotes` | Optional — any time after assessment |
| Audition Result | `auditionResult` | `auditionResult` | SPA / SPS only; CLEARED / NOT_CLEARED |
| Interview Date | `interviewDate` | `interviewDate` | When interview is scheduled |
| Interview Result | `interviewResult` | `interviewResult` | CLEARED / NOT_CLEARED |
| NAT Score | `natScore` | `natScore` | SPFL only |

### 5.3 SCP Assessment Type → Workflow Steps Mapping

| SCP | `assessmentType` | Workflow Steps |
|---|---|---|
| STE | `EXAM_ONLY` | Schedule exam → Record score → Pass/Fail |
| SPA | `EXAM_AUDITION` | Schedule (exam + audition same day) → Record score + audition result → Pass/Fail |
| SPS | `AUDITION_ONLY` | Schedule tryout → Record tryout result → Pass/Fail |
| SPJ | `EXAM_ONLY` + `requiresInterview: true` | Schedule exam → Record score → Schedule interview → Record interview → Pass/Fail |
| SPFL | `NAT_REVIEW` | Record NAT score (no scheduled exam) → Pass/Fail |
| SPTVE | `APTITUDE` | Schedule aptitude test → Record result → Pass/Fail |
| STEM G11 | `EXAM_ONLY` + `requiresInterview: true` | Verify G10 grades → Schedule exam → Record score → Schedule interview → Record result → Pass/Fail |

The `assessmentType` field on `ScpProgram` drives which buttons and forms appear in the registrar's `/applications` detail view. This is dynamic — a school that configures STE with `EXAM_ONLY` will not see an audition result field.

---

## 6. F2F Admission — Field Differences

The F2F form at `/f2f-admission` uses identical fields and validation rules with the following behavioral differences:

| Aspect | Online (`/apply`) | F2F (`/f2f-admission`) |
|---|---|---|
| Auth required | None (public) | JWT + REGISTRAR or SYSTEM_ADMIN |
| Enrollment gate | Redirects to `/closed` when OFF | Always accessible — registrar override |
| `admissionChannel` stored | `ONLINE` | `F2F` |
| `encodedById` stored | `null` | Registrar's `User.id` (auto from JWT) |
| Form layout | Multi-step wizard (6 steps) | Single scrollable page (6 sections) |
| Privacy consent | Applicant scrolls + checks on screen | Registrar checks physical signature confirmation |
| Fast-track option | Not available | "Save as Approved" button (status = APPROVED immediately) |
| Email requirement | Required | Optional — field shown; email sent only if provided |
| Tracking display | Prominent on-screen success panel + email | On-screen success toast + email if address given |
| `sessionStorage` backup | Yes — survives browser refresh | No — registrar does not need draft recovery |

---

## 7. Validation Rules

### Backend — Zod (`server/src/validators/application.validator.ts`)

```typescript
import { z } from 'zod';

export const applicationSchema = z.object({
  // Identity
  lrn:         z.string().regex(/^\d{12}$/, 'LRN must be exactly 12 digits'),
  lastName:    z.string().min(2).max(50),
  firstName:   z.string().min(2).max(50),
  middleName:  z.string().max(50).optional(),
  suffix:      z.enum(['Jr.', 'Sr.', 'II', 'III', 'IV', 'N/A', '']).optional(),
  birthDate:   z.string().refine(isValidBirthDate, 'Invalid or out-of-range birth date'),
  sex:         z.enum(['MALE', 'FEMALE']),

  // Contact
  guardianName:    z.string().min(2),
  guardianContact: z.string().regex(/^(09\d{9}|\(0\d{2}\) \d{4}-\d{4})$/, 'Invalid PH phone number'),
  emailAddress:    z.string().email(),
  address:         z.string().min(5),

  // Classification
  learnerType:             z.enum(['NEW_ENROLLEE', 'TRANSFEREE', 'RETURNING', 'CONTINUING']),
  isIndigenousPeople:      z.boolean(),
  ipCommunity:             z.string().optional(),
  is4PsBeneficiary:        z.boolean(),
  householdId:             z.string().optional(),
  isPersonWithDisability:  z.boolean(),
  disabilityType:          z.string().optional(),

  // Previous school
  lastSchoolAttended:  z.string().min(2),
  lastGradeCompleted:  z.string().min(2),
  generalAverage:      z.number().min(0).max(100).optional(),

  // Enrollment preference
  gradeLevelId:   z.number({ required_error: 'Grade level is required' }),
  strandId:       z.number().optional(),
  applicantType:  z.string().default('REGULAR'),
  scpProgramCode: z.string().optional(),

  // SCP-specific
  artField:            z.string().optional(),
  sport:               z.string().optional(),
  foreignLanguage:     z.string().optional(),
  grade10ScienceGrade: z.number().min(0).max(100).optional(),
  grade10MathGrade:    z.number().min(0).max(100).optional(),

  // Consent
  privacyConsentGiven: z.literal(true, {
    errorMap: () => ({ message: 'Data Privacy consent is required.' }),
  }),
}).superRefine((data, ctx) => {
  // G10 grades required for STEM G11
  if (data.applicantType === 'STEM_GRADE11') {
    if (data.grade10ScienceGrade === undefined)
      ctx.addIssue({ code: 'custom', path: ['grade10ScienceGrade'], message: 'Required for STEM applicants' });
    if (data.grade10MathGrade === undefined)
      ctx.addIssue({ code: 'custom', path: ['grade10MathGrade'], message: 'Required for STEM applicants' });
  }
  // IP community required if IP flag set
  if (data.isIndigenousPeople && !data.ipCommunity) {
    ctx.addIssue({ code: 'custom', path: ['ipCommunity'], message: 'IP community name is required.' });
  }
  // 4Ps Household ID required if 4Ps flag set
  if (data.is4PsBeneficiary && !data.householdId) {
    ctx.addIssue({ code: 'custom', path: ['householdId'], message: '4Ps Household ID is required.' });
  }
});
```

The same schema is used for both the online form and the F2F form — shared via the `client/src/validators/admissionSchema.ts` file on the frontend.

### Frontend — React Hook Form + Zod

```typescript
// client/src/validators/admissionSchema.ts — mirrors the backend schema
// Import in both Apply.tsx and F2FAdmission.tsx:
import { applicationSchema } from '@/validators/admissionSchema';
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(applicationSchema),
  defaultValues: sessionStorage.getItem('admission_form_draft')
    ? JSON.parse(sessionStorage.getItem('admission_form_draft')!)
    : {},
});
```

Validation fires on `onBlur` — never on every keystroke.

### LRN Uniqueness Check

```typescript
// Fires on onBlur of the LRN field, only when the field is 12 digits
const checkLrn = async (lrn: string) => {
  if (lrn.length !== 12) return;
  const { data } = await api.get(`/applicants/check-lrn/${lrn}`);
  if (data.alreadyEnrolled) {
    setError('lrn', { message: `This LRN is already enrolled for SY ${data.yearLabel}.` });
  } else if (data.existingApplicant) {
    // Pre-fill name and birthdate from prior year record
    setValue('lastName', data.existingApplicant.lastName);
    setValue('firstName', data.existingApplicant.firstName);
    toast.info('We found an existing record for this LRN. Please verify the pre-filled details.');
  }
};
```

### Complete Validation Reference

| Field | Rule |
|---|---|
| LRN | Exactly 12 numeric digits; unique per active AY |
| Birthdate | Valid date; Grade 7: ≥ 10 years old; Grade 11: ≥ 14 years old |
| Name fields | Letters only (including ñ, accented vowels); no numbers; hyphens allowed |
| Middle Name | Same as name fields; "N/A" accepted |
| Suffix | Only: Jr. / Sr. / II / III / IV / N/A |
| Sex | Required; binary (Male / Female) |
| Email | Standard email format |
| Contact Number | PH mobile: `09XXXXXXXXX` (11 digits) OR landline with area code |
| G10 Science/Math | Numeric 0–100; advisory (not hard block) if below 85 for STEM |
| Exam Score | Numeric 0–100; required after exam is taken |
| Grade Level | Must match a `GradeLevel.id` from the active academic year |
| Elective Cluster | Must match a `Strand.id` configured for the selected grade level and active AY |
| SCP Code | Must match an active `ScpProgram.code` for the selected grade level and active AY |
| `privacyConsentGiven` | Must be `true` — API rejects any submission where this is false |

---

## 8. Prisma Model Mapping

Key notes on how BEEF fields map to the `Applicant` Prisma model:

```prisma
model Applicant {
  id Int @id @default(autoincrement())

  // Section 1
  lrn                  String   @unique @db.VarChar(12)  // immutable after creation

  // Section 3
  lastName             String
  firstName            String
  middleName           String?
  suffix               String?
  birthDate            DateTime
  sex                  Sex
  birthPlace           String?
  nationality          String?
  religion             String?
  motherTongue         String?

  // Section 4 — Sensitive Personal Information
  isIndigenousPeople   Boolean @default(false)
  ipCommunity          String?
  is4PsBeneficiary     Boolean @default(false)
  householdId          String?
  isPersonWithDisability Boolean @default(false)
  disabilityType       String?

  // Section 5–6
  address              String
  barangay             String?
  municipality         String?
  province             String?
  fatherName           String?
  motherName           String?
  guardianName         String
  guardianRelationship String?
  guardianContact      String
  emailAddress         String

  // Section 7
  lastSchoolAttended   String?
  lastGradeCompleted   String?
  generalAverage       Float?

  // Section 8 (SHS — driven by configured strands)
  grade10ScienceGrade  Float?
  grade10MathGrade     Float?

  // Section 9
  learnerType          LearnerType @default(NEW_ENROLLEE)

  // Admission metadata
  admissionChannel     AdmissionChannel @default(ONLINE)
  applicantType        String           @default("REGULAR")
  scpProgramCode       String?
  trackingNumber       String           @unique   // auto-generated server-side
  status               ApplicationStatus @default(PENDING)
  encodedById          Int?              // F2F: registrar's User.id; null for online
  privacyConsentGiven  Boolean          @default(false)
  privacyConsentTimestamp DateTime?
  privacyConsentVersion   String?

  // SCP assessment fields (filled by registrar, not applicant)
  examDate         DateTime?
  assessmentType   String?
  examScore        Float?
  examResult       String?
  examNotes        String?
  auditionResult   String?
  interviewDate    DateTime?
  interviewResult  String?
  natScore         Float?
  artField         String?
  sport            String?
  foreignLanguage  String?

  // Foreign keys
  gradeLevelId   Int
  strandId       Int?
  academicYearId Int     // auto-set server-side to active AY — not sent by client
}
```

**Immutability rules enforced at the API and SIMS level:**
- `lrn` — immutable after creation; displayed as read-only in all edit forms
- `academicYearId` — set server-side; never sent by client
- `trackingNumber` — auto-generated UUID; never sent by client
- `encodedById` — set from JWT for F2F; never sent by client
- `admissionChannel` — set server-side based on endpoint (`/applications` vs `/applications/f2f`)

---

## 9. Data Privacy & Sensitive Field Handling

### 9.1 Sensitive Personal Information (SPI) — Access Controls

| SPI Field | API Exposure | UI Location |
|---|---|---|
| `isPersonWithDisability` + `disabilityType` | Detail view only (`GET /students/:id`) | SIMS Profile Tab 4 |
| `isIndigenousPeople` + `ipCommunity` | Detail view only | SIMS Profile Tab 4 |
| `is4PsBeneficiary` + `householdId` | Detail view only | SIMS Profile Tab 4 |
| Grade 10 grades | Application detail only (`GET /applications/:id`) | Application Detail — SCP applicants only |
| SCP assessment scores | Application detail only | Application Detail — SCP applicants only |

### 9.2 SPI Fields in Lists and Exports

SPI fields are **excluded from all paginated list responses**:
```typescript
// server/src/controllers/studentController.ts
// Select only non-SPI fields for list views:
const students = await prisma.applicant.findMany({
  select: {
    id: true, lrn: true, lastName: true, firstName: true,
    status: true, admissionChannel: true,
    gradeLevel: { select: { name: true } },
    enrollment: { select: { section: { select: { name: true } } } },
    // isIndigenousPeople, is4PsBeneficiary, isPersonWithDisability — EXCLUDED
  }
});
```

### 9.3 Audit Logging for SPI Edits

When a registrar edits an SPI field in SIMS, the audit log entry records field **names only** — never field values:

```
✅ STUDENT_RECORD_UPDATED — LRN 123456789012 — Changed: is4PsBeneficiary, householdId
❌ Changed: householdId from "4PS-12345" to "4PS-99999"  ← values NEVER in audit log
```

### 9.4 Additional Controls

| Control | Implementation |
|---|---|
| Consent gate | `privacyConsentGiven: z.literal(true)` — API rejects submission if false |
| Consent audit trail | `privacyConsentTimestamp` + `privacyConsentVersion` stored on `Applicant` |
| PSA BC in audit logs | Never include PSA BC number in log descriptions — use "PSA BC on file" |
| LRN in audit logs | Included only in the initial `APPLICATION_SUBMITTED` entry; subsequent logs use name + tracking number |
| URL privacy | Public-facing tracking URLs use `trackingNumber` (APP-YYYY-NNNNN) — never `id`, `lrn`, or any PII |

---

## 10. System Design Notes — All Five Modules

This section documents how the BEEF fields and admission data flow **beyond** the admission form — through all five system modules.

---

### Module 1 — Admission (Online + F2F)

The BEEF fields map directly to the `Applicant` table. All fields documented in §3–5 apply equally to both channels.

**Key decisions driven by BEEF data:**
- `gradeLevelId` determines which sections appear in the enrollment assignment dialog
- `applicantType` determines which workflow path (open admission vs. SCP) the application follows in `/applications`
- `strandId` filters the available sections to those matching the strand or SCP code
- `admissionChannel` distinguishes Online from F2F records in filters, dashboards, and the channel breakdown chart

**Shared components:**
- `GradeLevelSelect`, `ScpProgramSelect`, `StrandSelect`, `ScpConditionalFields` — shared between `Apply.tsx` and `F2FAdmission.tsx`. Any change applies to both channels.

---

### Module 2 — Enrollment Management (Registrar Only)

The enrollment management module (`/applications`) reads every `Applicant` field and exposes the SCP workflow fields to the registrar.

**How admission data drives the enrollment UI:**

| `Applicant` field | Effect in `/applications` |
|---|---|
| `applicantType` | Determines which action buttons appear (Approve vs. Schedule Exam vs. Record Result) |
| `status` | Drives the state machine — only valid transitions are shown |
| `strandId` | Filters the section assignment dialog to matching sections |
| `gradeLevelId` | Groups applications in the inbox filter and determines which sections are offered |
| `grade10ScienceGrade` / `grade10MathGrade` | Displayed in the SCP detail panel with ✅ / ⚠️ indicators |
| `scpProgramCode` | Matches `ScpProgram.assessmentType` to show the correct assessment workflow |
| `admissionChannel` | Shown as a badge (Online / Walk-in); filterable in the inbox |

**Enrollment restriction:** The Enrollment Management module is accessible only to REGISTRAR and SYSTEM_ADMIN roles. TEACHER has no access to applications or enrollment records.

---

### Module 3 — Student Information Management System (SIMS)

After a learner is enrolled (`status = ENROLLED`), their `Applicant` record becomes their **permanent student profile** in the SIMS. The `/students/:id` profile is a tabbed view over the same data.

**BEEF data in SIMS tabs:**

| SIMS Tab | `Applicant` Fields Shown |
|---|---|
| Tab 1 — Personal Information | All Section 3 fields (name, birthdate, sex, etc.); address fields; contact fields. All editable by REGISTRAR — changes create `STUDENT_RECORD_UPDATED` audit entries listing changed field names |
| Tab 2 — Academic History | `generalAverage` from previous school; all `Enrollment` records across AYs (grade level, section, enrolled date, enrolled by) |
| Tab 3 — Application Record | `trackingNumber`, `admissionChannel`, `createdAt`, full SCP assessment history (`examDate`, `examScore`, `examResult`, `auditionResult`, `interviewResult`, `examNotes`) |
| Tab 4 — Classifications | `learnerType`, `isIndigenousPeople`, `ipCommunity`, `is4PsBeneficiary`, `householdId`, `isPersonWithDisability`, `disabilityType` — RESTRICTED to REGISTRAR and SYSTEM_ADMIN only |

**Immutability rule:** `lrn` is displayed as plain text in the edit form — not an `<input>`. The backend rejects any `PUT /students/:id` body that includes the `lrn` field.

**LRN uniqueness across school years:** The same LRN may appear in multiple academic years (the learner re-enrolls each year). The `@unique` constraint is on `Applicant.lrn`, which means an LRN cannot have two `Applicant` records — the system recognizes the same learner across years via their single `Applicant` record, which accumulates multiple `Enrollment` records over time.

---

### Module 4 — Teacher Management

Teacher records are independent of the `Applicant` / BEEF data, but they are connected through the section assignment that links enrolled students to teacher-advised sections.

**How admission data connects to Teacher Management:**

```
Applicant (lrn, name, gradeLevelId)
    ↓ enrolled into
Enrollment (sectionId, enrolledById)
    ↓ section is advised by
Section (advisingTeacherId → Teacher.id → User.id)
    ↓ teacher views via
/my-sections → GET /api/teacher/sections → filtered by req.user → Teacher.id
```

**What teachers see about BEEF data:** Teachers can view the **roster** of their assigned sections at `/my-sections/:id` — this shows learner names, LRNs, and grade levels only. SPI fields (disability, IP, 4Ps status), SCP assessment records, and application history are **not shown to teachers**. These remain restricted to REGISTRAR and SYSTEM_ADMIN.

**Teacher account provisioning:** When the registrar provisions a system account for a teacher from `/teachers/:id`, a welcome email is sent. The email subject and body use `SchoolSettings.schoolName` at send time — never a hardcoded school name.

---

### Module 5 — Grade Level & Sectioning Management

The BEEF fields `gradeLevelId` and `strandId` are both foreign keys that point directly into the Grade Level and Sectioning module's configuration tables.

**How sectioning configuration drives admission:**

```
Settings Tab 3
  GradeLevel.name = "Grade 7"  (school-configured, not hardcoded)
       ↓ feeds
  GET /api/grade-levels  →  admission form Grade Level dropdown
       ↓ applicant selects Grade 7
  GET /api/scp-programs?gradeLevelId=  →  SCP dropdown (only active programs for G7)
  GET /api/strands?gradeLevelId=       →  Strand dropdown (only configured strands for G7)
       ↓ applicant submits
  Applicant.gradeLevelId = 1
       ↓ enrollment assigned
  Section.gradeLevelId = 1  →  only Grade 7 sections appear in assignment dialog
```

**Section capacity enforcement:** When the registrar approves an application and assigns a section, the server:
1. Counts current `Enrollment` records for that `sectionId`
2. Compares against `Section.maxCapacity`
3. If at capacity → returns `422 Unprocessable Entity`: "This section is at full capacity."
4. If near-concurrent → uses a `FOR UPDATE` PostgreSQL row lock within a transaction to prevent over-enrollment

**`Section.scpCode` field:** A section may be designated as an SCP section (e.g., `scpCode: "STE"`). This is informational only — the system does not enforce that only STE applicants are assigned to STE sections. It is visible as a badge in the section list and used for filtering.

**Capacity bar in `/sections`:**

```tsx
// Capacity bar uses semantic colors — NOT the school's accent color
const pct = (enrolled / maxCapacity) * 100;
const barColor =
  pct < 80  ? 'bg-green-500'  :
  pct < 100 ? 'bg-amber-500'  :
              'bg-red-500';
```

The capacity bar must never use `var(--accent)` — its meaning (safe / warning / full) must remain consistent across all schools regardless of brand color.

---

### Cross-Module: Dynamic Data Flow Summary

```
SchoolSettings.schoolName  ──────────────────────► All UI headers, privacy notice, emails
AcademicYear.yearLabel     ──────────────────────► Form header, stat cards, filter defaults
GradeLevel (per active AY) ──── /api/grade-levels ► Grade dropdown in admission + SIMS filters
Strand (per active AY)     ── /api/strands?gl=id  ► Strand dropdown in admission + section create
ScpProgram (per active AY) ─ /api/scp-programs?gl ► SCP dropdown in admission + application filter
Section (per grade level)  ──────────────────────► Section assignment dialog in enrollment
Teacher (per school)       ──────────────────────► Advising teacher assignment in sections
```

Every dropdown in the system is data-driven. A school that offers only Grades 7–10 (no SHS) will see no strand fields. A school that offers no SCP programs will see no SCP fields. A school that has no teachers registered will see an empty teacher dropdown in section creation. The system adapts to each school's configuration without any code changes.

---

*Document v3.0.0*
*System: School Admission, Enrollment & Information Management System*
*Modules: Admission (Online + F2F) · Enrollment Management · SIMS · Teacher Management · Grade Level & Sectioning Management*
*Policy: DepEd Order No. 017, s. 2025 · RA 10173 · DM 149, s. 2011 · DM 012, s. 2026*
*Design: School-agnostic — all grade levels, strands, SCP options, and school name are runtime-configurable*