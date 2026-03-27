# Student Information Management System (SIMS)
## Learner Records · Health Monitoring · Self-Service Portal

**Document Version:** 1.0.0
**System:** School Admission, Enrollment & Information Management System
**Module:** SIMS — `/students` (staff side) · `/learner` (self-service portal)
**Policy Basis:**
- DepEd Order No. 017, s. 2025 — Revised Basic Education Enrollment Policy
- DepEd Order No. 13, s. 2017 — School Health and Nutrition Policy
- RA 10173 — Data Privacy Act of 2012
- SF8 (School Form 8) — Learner's Basic Health and Nutrition Report
**Stack:** React 19 · Express.js 5.1 · PostgreSQL 18 · Prisma 6 · shadcn/ui · Tailwind CSS v4

---

## Table of Contents

1. [What the SIMS Is](#1-what-the-sims-is)
2. [DepEd Policy Basis for Health Records](#2-deped-policy-basis-for-health-records)
3. [Two Sides of the SIMS](#3-two-sides-of-the-sims)
4. [Staff Side — Student Directory (`/students`)](#4-staff-side--student-directory-students)
5. [Staff Side — Student Profile (`/students/:id`)](#5-staff-side--student-profile-studentsid)
   - 5.1 [Tab 1 — Personal Information](#51-tab-1--personal-information)
   - 5.2 [Tab 2 — Academic History](#52-tab-2--academic-history)
   - 5.3 [Tab 3 — Application Record](#53-tab-3--application-record)
   - 5.4 [Tab 4 — Classifications & Special Programs](#54-tab-4--classifications--special-programs)
   - 5.5 [Tab 5 — Health Records (SF8)](#55-tab-5--health-records-sf8)
6. [BMI & Nutritional Status Classification](#6-bmi--nutritional-status-classification)
7. [Height for Age (HFA) Classification](#7-height-for-age-hfa-classification)
8. [Learner Self-Service Portal (`/learner`)](#8-learner-self-service-portal-learner)
   - 8.1 [Access Method — No Login Account Required](#81-access-method--no-login-account-required)
   - 8.2 [Lookup Flow](#82-lookup-flow)
   - 8.3 [What the Learner Sees](#83-what-the-learner-sees)
   - 8.4 [What Is Excluded from the Learner Portal](#84-what-is-excluded-from-the-learner-portal)
9. [Prisma Schema — HealthRecord Model](#9-prisma-schema--healthrecord-model)
10. [API Contracts](#10-api-contracts)
11. [Audit Logging](#11-audit-logging)
12. [Data Privacy & RA 10173 Compliance](#12-data-privacy--ra-10173-compliance)
13. [Component & File Structure](#13-component--file-structure)
14. [Acceptance Criteria](#14-acceptance-criteria)

---

## 1. What the SIMS Is

The Student Information Management System (SIMS) is the **permanent records module** of the system. Every learner who has ever applied or enrolled in this school — across all school years — has a record here.

The SIMS serves two audiences:

| Audience | Access Method | What They Can Do |
|---|---|---|
| **Registrar / System Admin** | JWT login at `/login` | View all records · Edit personal information · Enter health records · View SPI fields |
| **Learner / Parent** | LRN + Date of Birth at `/learner` | View own records only · Read-only · No password required |

The SIMS is explicitly **not a grading system**. Grades are excluded from both the staff view and the learner portal — this is consistent with the adviser's instruction and is also appropriate given that grades are managed separately through DepEd LIS, SF9, and the E-Class Record system.

---

## 2. DepEd Policy Basis for Health Records

### School Form 8 (SF8) — Learner's Basic Health and Nutrition Report

The SF8 tracks every learner's health by keeping a complete record of their weight and height from the beginning to the end of the school year. It entails a health profile and Body Mass Index (BMI) assessment for every learner. At the beginning of the school year (BoSY) and the end of the school year (EoSY), the class adviser/MAPEH teacher is required by DepEd to complete and submit the SF8.

According to DepEd Order No. 13, s. 2017, maintaining accurate health records is vital for effective intervention and feeding programs. Teachers and school health coordinators can monitor the nutritional trends among learners and respond with targeted health strategies.

All learners shall undergo Nutritional Status Assessment, particularly utilizing the Body Mass Index (BMI) and Height For Age (HFA). Hence, all reports must be 100% completed. Schools shall utilize the Body Mass Index Software or the School Form 8 (SF8) provided by the Central Office.

### Two Assessment Points Per School Year

| Timing | Label | When |
|---|---|---|
| Beginning of School Year | **BoSY** | Within the first few weeks of class opening (June) |
| End of School Year | **EoSY** | Before school year closes (March) |

At the beginning of the school year, with the assistance of the School Nurse (if any), the adviser/MAPEH teacher will conduct actual measurements of height and weight to calculate the BMI value and weight status. The procedure is repeated as deemed necessary to measure improvement before the end of the school year.

### Who Conducts the Assessment

Typically, the school nurse or a teacher with anthropometry training will complete the SF8 form. The measurement of the human body is known as anthropometry. Therefore, the BMI is a measurement of their general nutritional status.

In the context of this system: the **Registrar enters the health record data** into the system on behalf of the class adviser or school nurse after the physical measurements are taken. The system does not replace the SF8 — it digitizes the individual learner's records from the SF8 for access through the learner portal.

### SF8 Data Elements Captured in This System

The template includes essential fields like LRN, Learner's Name, Birthdate, Age, Weight, Height, calculated Height², BMI (kg/m²), BMI Category, Nutritional Status, and Height for Age (HFA).

Of these, this system stores: **Weight (kg), Height (cm), Assessment Period (BoSY/EoSY), School Year, Date Recorded, and Assessed By**. BMI and all classification labels are **always computed at display time** — never stored in the database.

---

## 3. Two Sides of the SIMS

```
 STAFF SIDE                            LEARNER PORTAL
 (/students — JWT required)            (/learner — public, no login)
 ─────────────────────────             ──────────────────────────────
 Full record — all 5 tabs              Own record only — 4 sections
 Includes SPI fields                   SPI fields hidden
 Editable                              Read-only
 Health records: add / edit            Health records: view only
 Grades: excluded                      Grades: excluded
 Access: REGISTRAR + SYSTEM_ADMIN      Access: LRN + Date of Birth
```

---

## 4. Staff Side — Student Directory (`/students`)

```
Route  : /students
Auth   : JWT required — REGISTRAR, SYSTEM_ADMIN
Page   : client/src/pages/students/Index.tsx
API    : GET /api/students
```

### Directory Wireframe

```
STUDENTS                    [ Search by LRN or name... 🔍 ]    [Filter ▾]

  Grade: [All ▾]  Section: [All ▾]  Year: [All ▾]  Status: [All ▾]  Channel: [All ▾]

  LRN            │ Full Name            │ Grade   │ Section │ Channel  │ Status     │ Actions
  ───────────────┼──────────────────────┼─────────┼─────────┼──────────┼────────────┼──────────
  123456789012   │ Dela Cruz, Juan R.   │ Grade 7 │ Rizal   │ Online   │ ✓ ENROLLED │ [View]
  876543219012   │ Santos, Maria L.     │ Grade 11│ STEM-A  │ Walk-in  │ ✓ ENROLLED │ [View]
  998877665544   │ Garcia, Pedro T.     │ Grade 9 │ Luna    │ Online   │ ◎ APPROVED │ [View]
```

### Search & Filters

- **Search:** LRN (exact 12-digit) or name — 300ms debounce, no full reload
- **Grade Level:** Dynamic from active AY database — never hardcoded
- **Section:** Filtered by selected grade level
- **School Year:** All historical AYs available — defaults to active AY
- **Enrollment Status:** PENDING · APPROVED · ENROLLED · REJECTED
- **Admission Channel:** Online · Walk-in (F2F)

### API

```
GET /api/students?search=&gradeLevelId=&sectionId=&schoolYearId=&status=&channel=&page=&limit=

Response: { students: [...], total, page, limit }
```

**SPI fields** (`isIpCommunity`, `is4PsBeneficiary`, `isLearnerWithDisability`, etc.) are **never returned** in the directory listing endpoint — only in the individual profile endpoint.

---

## 5. Staff Side — Student Profile (`/students/:id`)

```
Route  : /students/:id
Auth   : JWT required — REGISTRAR, SYSTEM_ADMIN
Page   : client/src/pages/students/Profile.tsx
API    : GET /api/students/:id
```

The student profile has **5 tabs**. The registrar navigates between them using a horizontal tab bar at the top of the profile card.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Students                                                         │
│                                                                             │
│  DELA CRUZ, Juan Reyes                           Status: ✓ ENROLLED         │
│  LRN: 123456789012  ·  Grade 7 – Rizal  ·  SY 2026–2027                    │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Personal Info │ Academic History │ Application │ Classifications │ Health│
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [tab content here]                                    [ Edit Record ]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.1 Tab 1 — Personal Information

All BEEF (Basic Education Enrollment Form) demographic fields. **Editable** by REGISTRAR and SYSTEM_ADMIN via the `[ Edit Record ]` button.

```
PERSONAL INFORMATION                              [ Edit Record ]

  LRN              123456789012              [READ-ONLY — immutable]
  PSA BC No.       PSA-2014-0042381
  Last Name        DELA CRUZ
  First Name       Juan
  Middle Name      Reyes
  Suffix           N/A
  Date of Birth    March 12, 2014            Age: 12
  Sex              Male
  Place of Birth   Bacolod City, Negros Occidental
  Nationality      Filipino
  Religion         Roman Catholic
  Mother Tongue    Hiligaynon

CONTACT & GUARDIAN
  Legal Guardian   Maria Reyes Dela Cruz (Mother)
  Contact Number   0917-123-4567
  Email Address    delacruz@gmail.com

CURRENT ADDRESS
  123 Magsaysay Street, Brgy. San Antonio
  Bacolod City, Negros Occidental 6100

ENROLLMENT PREFERENCE
  Learner Type     New Enrollee
  Grade Level      Grade 7
  Program          Regular Admission
  Modality         Face-to-Face
```

**Edit rules:**
- LRN is always read-only — displayed as plain text, never an `<input>`
- Saving any edit creates `AuditLog: STUDENT_RECORD_UPDATED` listing changed field names only (not values, for SPI fields)
- Sensitive fields (4Ps, IP, PWD) require a separate confirmation dialog before saving

---

### 5.2 Tab 2 — Academic History

Read-only. Chronological list of all enrollment records across all school years.

```
ACADEMIC HISTORY

  School Year   │ Grade Level │ Section    │ Date Enrolled  │ Enrolled By
  ──────────────┼─────────────┼────────────┼────────────────┼──────────────────
  2026–2027     │ Grade 7     │ Rizal      │ Feb 3, 2026    │ Cruz, Regina
  2025–2026     │ Grade 6     │ (prev. school — [Elementary Name])  │ —  │ —

  Previous school general average: 92.5 (SY 2024–2025)
```

---

### 5.3 Tab 3 — Application Record

Read-only. Original submission details and status timeline.

```
APPLICATION RECORD

  Tracking Number   APP-2026-00055
  Channel           Online
  Submitted         February 3, 2026 at 9:14 AM
  Program           Regular Admission

  STATUS HISTORY
  ● Feb 3, 2026   Application Submitted (Online)
  ● Feb 3, 2026   Approved → Grade 7 Rizal  (Cruz, Regina)
```

For SCP learners, this tab additionally shows the full assessment record (exam date, score, audition result, interview result, notes).

---

### 5.4 Tab 4 — Classifications & Special Programs

Read-only display. Editable via Edit Record on Tab 1.

```
LEARNER CLASSIFICATIONS        [🔒 Sensitive — RA 10173]

  Learner Type         New Enrollee
  IP Community         No
  4Ps Beneficiary      No
  LWD                  No

SPECIAL PROGRAM
  SCP                  None (Regular)
```

If any SPI value is `Yes`:
```
  4Ps Beneficiary      ⚠ Yes
  4Ps Household ID     1234567890

  LWD                  ⚠ Yes
  Disability Type      Hearing Impairment
```

**SPI access:** These fields are returned by the API only when the JWT role is REGISTRAR or SYSTEM_ADMIN. The `/learner` portal endpoint never returns them.

---

### 5.5 Tab 5 — Health Records (SF8)

Based on the DepEd SF8 (Learner's Basic Health and Nutrition Report). This tab is the system's digital equivalent of the SF8 at the individual learner level.

#### Display

```
HEALTH RECORDS              [ + Add Record ]

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  MOST RECENT — SY 2026–2027 (EoSY)                                      │
  │  Weight: 52.0 kg    Height: 158.0 cm    BMI: 20.8    ● Normal           │
  │  HFA: Normal   ·   Recorded: March 20, 2027   ·   By: Cruz, Regina       │
  └──────────────────────────────────────────────────────────────────────────┘

  School Year  │ Period │ Weight (kg) │ Height (cm) │ BMI   │ Status    │ HFA    │ Actions
  ─────────────┼────────┼─────────────┼─────────────┼───────┼───────────┼────────┼─────────
  2026–2027    │ EoSY   │  52.0       │  158.0      │ 20.8  │ ● Normal  │ Normal │ [Edit]
  2026–2027    │ BoSY   │  48.5       │  155.0      │ 20.2  │ ● Normal  │ Normal │ [Edit]
  2025–2026    │ EoSY   │  44.0       │  150.0      │ 19.6  │ ● Normal  │ Normal │ [Edit]
  2025–2026    │ BoSY   │  41.5       │  147.5      │ 19.1  │ ● Normal  │ Normal │ [Edit]
```

**Key rules:**
- Records are ordered newest-first; the most recent is shown prominently in a summary card
- **BMI is computed at render time** — `weightKg / ((heightCm / 100) ** 2)` — and rounded to 1 decimal place. It is **never stored in the database**
- **Nutritional Status** (Severely Wasted / Wasted / Normal / Overweight / Obese) is derived from BMI and the learner's sex and age at the time of recording, using the **WHO BMI-for-age z-score** reference — computed at render, never stored
- **Height for Age (HFA)** classification is derived from height, sex, and age using WHO HFA z-score tables — computed at render, never stored
- **No delete action** — records are append-only. Correction is done via Edit
- All entries are attributed to the Registrar who entered them and the date they were entered

#### Add Record Dialog

```
┌────────────────────────────────────────────────────────────────────────┐
│  Add Health Record                                                      │
│  DELA CRUZ, Juan Reyes  ·  Grade 7                                     │
│  ───────────────────────────────────────────────────────────────────   │
│  School Year *    [ SY 2026–2027 ▾ ]  (defaults to active AY)          │
│                                                                        │
│  Assessment Period *                                                   │
│  ●  BoSY (Beginning of School Year)                                    │
│  ○  EoSY (End of School Year)                                          │
│                                                                        │
│  Assessment Date *   [ June 10, 2026   📅 ]                             │
│                                                                        │
│  Weight *   [ 48.5  ] kg     Height *   [ 155.0 ] cm                   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  BMI Preview (computed)                                          │  │
│  │  BMI: 20.2 kg/m²                                                 │  │
│  │  Nutritional Status: ● Normal                                    │  │
│  │  Height for Age (HFA): Normal                                    │  │
│  │  (Age at assessment: 12 years, 3 months)                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  Notes (optional)                                                      │
│  [ Post-physical exam. School nurse assisted.           ]              │
│                                                                        │
│          [ Cancel ]         [ Save Health Record ]                    │
└────────────────────────────────────────────────────────────────────────┘
```

**BMI preview behavior:**
- Updates live as weight and height are typed — no "Calculate" button needed
- Age is computed from `Applicant.birthDate` and the entered `assessmentDate`
- Nutritional Status and HFA labels appear immediately after both weight and height are entered
- The preview is purely informational — the computed values are not submitted to the API

#### Edit Record Dialog

Identical to Add Record dialog, pre-populated with existing values. Saves via `PUT /api/students/:id/health-records/:recId`. Creates `AuditLog: HEALTH_RECORD_UPDATED`.

---

## 6. BMI & Nutritional Status Classification

DepEd uses **WHO BMI-for-Age Z-scores** (BAZ) for classifying learners. This is the correct standard for school-age children and adolescents — the simple adult BMI ranges (18.5/25/30) are **not appropriate for learners under 18** and should not be used.

### DepEd SF8 Nutritional Status Categories

The BMI Category needs to be defined as Severely Wasted, Wasted, Normal, Overweight, or Obese.

| Category | WHO BAZ (Z-score) | Visual Indicator |
|---|---|---|
| **Severely Wasted** | BAZ < −3 SD | 🔴 Red |
| **Wasted** | −3 SD ≤ BAZ < −2 SD | 🟠 Orange |
| **Normal** | −2 SD ≤ BAZ ≤ +1 SD | 🟢 Green |
| **Overweight** | +1 SD < BAZ ≤ +2 SD | 🟡 Amber |
| **Obese** | BAZ > +2 SD | 🔴 Red |

These thresholds are based on **WHO 2007 Growth Reference for school-age children and adolescents (5–19 years)**, which is the standard DepEd uses in its SF8 and nutritional assessment programs.

### Why Not Use Adult BMI Ranges

The simple adult BMI cutoffs (underweight < 18.5, normal 18.5–24.9, overweight 25–29.9, obese ≥ 30) apply to adults aged 20 and above. For learners in Grades 7–12 (typically aged 12–18), the WHO BMI-for-Age Z-score accounts for normal growth patterns at each age and sex. Using adult cutoffs would misclassify many healthy adolescents as overweight or underweight.

### Frontend BMI Classification Function

```typescript
// client/src/utils/bmi.ts

interface BmiResult {
  bmi:          number;
  category:     'Severely Wasted' | 'Wasted' | 'Normal' | 'Overweight' | 'Obese';
  color:        'red' | 'orange' | 'green' | 'amber';
  baz:          number;   // Z-score
}

/**
 * Computes BMI and classifies nutritional status using WHO BAZ for school-age learners.
 * weightKg, heightCm, ageMonths, sex — all required.
 * Returns bmi (always), plus category based on BAZ lookup table.
 */
export function computeBmi(
  weightKg: number,
  heightCm: number,
  birthDate: Date,
  assessmentDate: Date,
  sex: 'MALE' | 'FEMALE',
): BmiResult {
  const bmi = weightKg / Math.pow(heightCm / 100, 2);

  // Age in months at time of assessment
  const ageMonths =
    (assessmentDate.getFullYear() - birthDate.getFullYear()) * 12 +
    (assessmentDate.getMonth() - birthDate.getMonth());

  // Look up median (M), standard deviation coefficient (S), and Box-Cox power (L)
  // from WHO 2007 BMI-for-Age reference tables (stored as constants in the app)
  const { L, M, S } = lookupWhoReference('BMI', sex, ageMonths);

  // WHO LMS method: Z = ((BMI/M)^L - 1) / (L * S)
  const baz = (Math.pow(bmi / M, L) - 1) / (L * S);

  let category: BmiResult['category'];
  let color: BmiResult['color'];

  if (baz < -3) {
    category = 'Severely Wasted'; color = 'red';
  } else if (baz < -2) {
    category = 'Wasted';           color = 'orange';
  } else if (baz <= 1) {
    category = 'Normal';           color = 'green';
  } else if (baz <= 2) {
    category = 'Overweight';       color = 'amber';
  } else {
    category = 'Obese';            color = 'red';
  }

  return { bmi: Math.round(bmi * 10) / 10, category, color, baz: Math.round(baz * 100) / 100 };
}
```

**WHO reference tables** are stored as static TypeScript constants in `client/src/constants/whoGrowthReference.ts` — loaded once at app startup, no API call needed.

---

## 7. Height for Age (HFA) Classification

Height for Age (HFA) is the learner's height in relation to their age and needs to be classified as Severely Stunted, Stunted, Normal, or Tall.

| Category | WHO HAZ (Z-score) | Visual Indicator |
|---|---|---|
| **Severely Stunted** | HAZ < −3 SD | 🔴 Red |
| **Stunted** | −3 SD ≤ HAZ < −2 SD | 🟠 Orange |
| **Normal** | −2 SD ≤ HAZ ≤ +3 SD | 🟢 Green |
| **Tall** | HAZ > +3 SD | 🔵 Blue |

HFA uses the WHO 2007 Height-for-Age Z-score reference (same source as BMI-for-Age). The computation follows the same LMS method but uses height instead of BMI.

```typescript
// client/src/utils/bmi.ts (continued)

interface HfaResult {
  category: 'Severely Stunted' | 'Stunted' | 'Normal' | 'Tall';
  haz:      number;
  color:    'red' | 'orange' | 'green' | 'blue';
}

export function computeHfa(
  heightCm:       number,
  birthDate:      Date,
  assessmentDate: Date,
  sex:            'MALE' | 'FEMALE',
): HfaResult {
  const ageMonths =
    (assessmentDate.getFullYear() - birthDate.getFullYear()) * 12 +
    (assessmentDate.getMonth() - birthDate.getMonth());

  const { L, M, S } = lookupWhoReference('HFA', sex, ageMonths);
  const haz = (Math.pow(heightCm / M, L) - 1) / (L * S);

  let category: HfaResult['category'];
  let color: HfaResult['color'];

  if (haz < -3) {
    category = 'Severely Stunted'; color = 'red';
  } else if (haz < -2) {
    category = 'Stunted';           color = 'orange';
  } else if (haz <= 3) {
    category = 'Normal';            color = 'green';
  } else {
    category = 'Tall';              color = 'blue';
  }

  return { category, haz: Math.round(haz * 100) / 100, color };
}
```

---

## 8. Learner Self-Service Portal (`/learner`)

```
Route  : /learner
Auth   : None — public, no login required
Page   : client/src/pages/learner/LearnerPortal.tsx
API    : POST /api/learner/lookup
```

### 8.1 Access Method — Three-Factor Lookup (LRN + Date of Birth + PIN)

The learner portal uses **LRN + Date of Birth + 6-digit PIN** as the three-factor identity verification combination. No username or password account is required.

| Factor | What It Is | Who Knows It |
|---|---|---|
| **LRN** | 12-digit Learner Reference Number | Learner, parent, school — printed on SF9 |
| **Date of Birth** | Learner's birthdate | Learner, parent, school |
| **6-digit PIN** | System-generated at enrollment | Registrar distributes on the enrollment confirmation slip — known only to the learner and parent |

**Why three factors instead of two:**
LRN and birthdate alone can both be known by classmates — the LRN appears on shared class lists and report cards, and birthdates are often public knowledge. The PIN is the private factor that prevents unauthorized access. A classmate who knows another learner's LRN and birthdate cannot access their records without the PIN, which is issued only to the learner's parent at the point of enrollment.

**Why not a full login account:**
- No password management overhead for hundreds of learners
- No account recovery / forgot-password workflow needed
- Read-only portal — the PIN is a privacy gate, not a full authentication system
- Consistent with the simplicity appropriate for a school registrar to operate

**Rate limiting:** `POST /api/learner/lookup` is limited to **10 attempts per 15 minutes per IP address**. After 10 failed attempts, the endpoint returns `429 Too Many Requests`.

### 8.2 Lookup Flow

```
Learner or Parent visits /learner
      │
      ▼
┌────────────────────────────────────────────────────────────────┐
│  View Your School Records             [School Name]            │
│  [School Logo]                                                 │
│  ─────────────────────────────────────────────────────────── │
│                                                                │
│  Learner Reference Number (LRN) *                              │
│  [ 123456789012                    ]                           │
│                                                                │
│  Date of Birth *                                               │
│  [ March    ▾ ]  [ 12  ▾ ]  [ 2014  ▾ ]                        │
│                                                                │
│  Portal PIN *                                                  │
│  [ ● ● ● ● ● ● ]  (6-digit PIN from your enrollment slip)     │
│  [ Forgot PIN? Contact the school registrar. ]                 │
│                                                                │
│                [ View My Records → ]                           │
│                                                                │
│  ──────────────────────────────────────────────────────────    │
│  For staff access, use the Staff Login link in the footer.     │
└────────────────────────────────────────────────────────────────┘
```

**On submit — three checks in order:**
1. LRN validated as exactly 12 digits (client-side, instant)
2. PIN validated as exactly 6 digits (client-side, instant)
3. Server checks: `Applicant` where `lrn = :lrn AND birthDate = :birthDate`
   - If no applicant found → `404` generic error
   - If applicant found → `bcrypt.compare(pin, applicant.portalPin)`
   - PIN matches → scoped read-only payload returned
   - PIN does not match → `401` generic error

**Error message rules:**
- All error states return the same generic message: *"The information you entered did not match our records. Please check your LRN, Date of Birth, and PIN."*
- The message never indicates which of the three factors was wrong — this prevents an attacker from confirming whether an LRN exists in the system

**Portal availability:**
- The portal is only accessible for learners with `status = ENROLLED`
- Learners with `PENDING` or `APPROVED` status do not yet have a PIN (it is generated at enrollment confirmation) — they see: *"Your enrollment is not yet finalized. The portal will be available once your enrollment is confirmed."*

### 8.2.1 — PIN Lifecycle

#### Generation — When Is the PIN Created?

The PIN is generated **at the moment the Registrar confirms enrollment** — when the applicant's status transitions to `ENROLLED`. It is not generated at PENDING or APPROVED.

```ts
// server/src/services/enrollmentService.ts

import crypto       from 'crypto';
import bcryptjs     from 'bcryptjs';

export function generatePortalPin(): { raw: string; hash: string } {
  // 6-digit numeric PIN — left-padded with zeros if necessary
  const raw  = String(crypto.randomInt(0, 999_999)).padStart(6, '0');
  const hash = bcryptjs.hashSync(raw, 10);
  return { raw, hash };
}
```

```ts
// Called inside the enrollment confirmation transaction:
const { raw, hash } = generatePortalPin();

await prisma.applicant.update({
  where: { id: applicantId },
  data:  {
    status:             'ENROLLED',
    portalPin:          hash,              // bcrypt hash — registrar cannot retrieve raw PIN
    portalPinChangedAt: new Date(),
  },
});

// PIN printed on the enrollment confirmation slip for the parent
// The raw PIN is used ONLY here — it is never stored in plain text
```

#### Distribution — How Does the Learner Get the PIN?

The raw 6-digit PIN is **printed on the enrollment confirmation slip** that the Registrar hands to the parent at the end of the enrollment process. This is the only time the raw PIN is available.

```
╔══════════════════════════════════════════════════════════════╗
║  ENROLLMENT CONFIRMATION SLIP            [School Name]       ║
║  ──────────────────────────────────────────────────────────  ║
║  Learner Name   : DELA CRUZ, Juan Reyes                      ║
║  LRN            : 123456789012                               ║
║  Grade / Section: Grade 7 — Rizal                            ║
║  School Year    : SY 2026–2027                               ║
║  Status         : ✓ ENROLLED                                 ║
║                                                              ║
║  ──────────────────────────────────────────────────────────  ║
║  LEARNER PORTAL ACCESS                                       ║
║  Visit: [system URL]/learner                                  ║
║                                                              ║
║  LRN       : 123456789012                                    ║
║  Birthdate : March 12, 2014                                  ║
║  PIN       : 4 7 3 9 1 2          ← printed once, keep safe ║
║                                                              ║
║  Keep this slip. The PIN cannot be retrieved once lost.      ║
║  Contact the Registrar's Office to reset a forgotten PIN.    ║
╚══════════════════════════════════════════════════════════════╝
```

The school name on the slip comes from `SchoolSettings.schoolName` — never hardcoded.

#### Reset — What If the PIN Is Lost?

If the learner or parent loses the PIN:
1. They visit the school registrar in person
2. Registrar verifies identity (presents the learner, shows SF9 or PSA BC)
3. Registrar clicks **[Reset Portal PIN]** on the student profile → Tab 1
4. System generates a new 6-digit PIN, hashes it, saves it
5. New PIN is printed on a new slip and handed to the parent
6. `AuditLog: PORTAL_PIN_RESET — "Registrar [name] reset portal PIN for LRN [lrn]"`

**The Registrar cannot view the current PIN** — it is stored as a bcrypt hash. The only way to "see" the PIN is to generate a new one.

#### Security Properties

| Property | Implementation |
|---|---|
| **PIN never stored in plain text** | bcrypt hash with 10 rounds — `bcryptjs.hashSync(raw, 10)` |
| **Registrar cannot retrieve PIN** | Hash is one-way — even the registrar cannot reverse it |
| **Constant-time comparison** | `bcrypt.compare()` is used — not string equality, prevents timing attacks |
| **Rate limiting** | 10 attempts / 15 min / IP — brute-forcing 6 digits at 10/15min would take ~1 day for a single target, which triggers account-level alerts |
| **Three-factor requirement** | Attacker needs LRN + birthdate + PIN — knowing two of three is not enough |
| **Enrollment-only** | Pre-enrollment applicants have no PIN — the portal is inaccessible until status = ENROLLED |

### 8.3 What the Learner Sees

A single scrollable page with four sections. No tabs — designed to be readable on a mobile phone.

```
┌──────────────────────────────────────────────────────────────────────┐
│  [School Logo]    [School Name]                                      │
│  MY SCHOOL RECORDS                           [ Print / Save as PDF ] │
│  SY 2026–2027                                                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ── MY INFORMATION ─────────────────────────────────────────────── │
│                                                                      │
│  Full Name       DELA CRUZ, Juan Reyes                               │
│  LRN             123456789012                                        │
│  Date of Birth   March 12, 2014                                      │
│  Sex             Male                                                │
│  Age             12                                                  │
│  Mother Tongue   Hiligaynon                                          │
│  Nationality     Filipino                                            │
│  Religion        Roman Catholic                                      │
│  Address         123 Magsaysay St., Brgy. San Antonio,               │
│                  Bacolod City, Negros Occidental                     │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ── CURRENT ENROLLMENT ─────────────────────────────────────────── │
│                                                                      │
│  School Year     SY 2026–2027                                        │
│  Grade Level     Grade 7                                             │
│  Section         Rizal                                               │
│  Class Adviser   Santos, Caridad M.                                  │
│  Status          ✓ ENROLLED                                          │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ── ENROLLMENT HISTORY ─────────────────────────────────────────── │
│                                                                      │
│  SY 2026–2027    Grade 7    Rizal               ✓ ENROLLED           │
│  SY 2025–2026    Grade 6    [Previous School]   (prior school)       │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ── HEALTH RECORDS ─────────────────────────────────────────────── │
│                                                                      │
│  MOST RECENT MEASUREMENT                                             │
│  School Year: SY 2026–2027  ·  EoSY  ·  March 20, 2027              │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Weight          52.0 kg                                     │  │
│  │  Height          158.0 cm                                    │  │
│  │  BMI             20.8 kg/m²                                  │  │
│  │  Status          ● Normal                                    │  │
│  │  Height for Age  Normal                                      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ALL MEASUREMENTS                                                    │
│                                                                      │
│  Year        Period  Weight  Height  BMI    Status     HFA           │
│  ─────────────────────────────────────────────────────────────────  │
│  2026–2027   EoSY    52.0    158.0   20.8   ● Normal   Normal        │
│  2026–2027   BoSY    48.5    155.0   20.2   ● Normal   Normal        │
│  2025–2026   EoSY    44.0    150.0   19.6   ● Normal   Normal        │
│  2025–2026   BoSY    41.5    147.5   19.1   ● Normal   Normal        │
│                                                                      │
│  ⓘ BMI and nutritional status are computed using WHO 2007 Growth    │
│    Reference for school-age children (5–19 years).                  │
│    This information is for reference only. Consult the school        │
│    clinic or a qualified health professional for medical advice.     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**BMI and nutritional status** are computed on the frontend at render time — same `computeBmi()` and `computeHfa()` functions as the staff side.

**Print / Save as PDF button** — triggers `window.print()` with a print-optimized CSS stylesheet. The printed output includes the school name and logo from `SchoolSettings` — never hardcoded.

### 8.4 What Is Excluded from the Learner Portal

The following information is intentionally excluded from the learner-facing portal. The server **strips these fields** from the API response before sending — they are never present in the payload regardless of what is in the database.

| Excluded Information | Reason |
|---|---|
| **Grades / academic performance** | Explicitly excluded per adviser instruction; grades are in DepEd LIS / E-Class Record |
| **4Ps beneficiary status and Household ID** | Sensitive Personal Information under RA 10173 — unnecessary for self-service |
| **IP community affiliation** | SPI under RA 10173 |
| **PWD / disability status and type** | SPI under RA 10173 |
| **Guardian contact number** | Privacy — parent/guardian can see their own number; not needed in self-service |
| **SCP exam scores and results** | Internal assessment records |
| **Application tracking number** | Internal reference not meaningful to learners |
| **Admission channel** | Internal system detail |
| **Rejection reason** | Internal administrative note |
| **`encodedById` / who entered the application** | Internal system detail |
| **Privacy consent timestamp** | Internal compliance record |

---

## 9. Prisma Schema — HealthRecord Model

```prisma
// server/prisma/schema.prisma

// ─── Health Records ────────────────────────────────────────────────────
// Corresponds to DepEd SF8 (Learner's Basic Health and Nutrition Report).
// One record = one assessment (BoSY or EoSY).
//
// BMI, Nutritional Status (Severely Wasted / Wasted / Normal / Overweight / Obese),
// and HFA (Severely Stunted / Stunted / Normal / Tall) are NEVER stored —
// they are always computed at display time using WHO 2007 Growth Reference.
//
// Formula: BMI = weightKg / ((heightCm / 100) ^ 2)

model HealthRecord {
  id              Int                   @id @default(autoincrement())
  applicantId     Int                   // FK to Applicant.id
  schoolYearId    Int                   // FK to AcademicYear.id — which AY this assessment belongs to
  assessmentPeriod AssessmentPeriod     // BoSY or EoSY
  assessmentDate  DateTime              // actual date of physical measurement
  weightKg        Float                 // body weight in kilograms (e.g. 48.5)
  heightCm        Float                 // height in centimeters (e.g. 155.0)
  notes           String?               // optional — e.g. "School nurse assisted"
  recordedById    Int                   // FK to User.id — Registrar who entered this record
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  applicant    Applicant    @relation(fields: [applicantId],  references: [id], onDelete: Cascade)
  schoolYear   AcademicYear @relation(fields: [schoolYearId], references: [id])
  recordedBy   User         @relation("HealthRecordRecordedBy", fields: [recordedById], references: [id])

  @@unique([applicantId, schoolYearId, assessmentPeriod])
  @@index([applicantId])
  @@index([applicantId, schoolYearId])

  @@map("health_records")
}

enum AssessmentPeriod {
  BOSY  // Beginning of School Year
  EOSY  // End of School Year
}
```

**The `@@unique` constraint on `[applicantId, schoolYearId, assessmentPeriod]`** enforces that each learner has at most **one BoSY record and one EoSY record per school year** — consistent with how SF8 works in DepEd.

**Migration:**
```bash
pnpm prisma migrate dev --name add_health_records_and_portal_pin
```

Also add to the `Applicant` model:
```prisma
healthRecords      HealthRecord[]
portalPin          String?    // bcrypt hash of the 6-digit portal PIN — null until status = ENROLLED
portalPinChangedAt DateTime?  // timestamp of last PIN generation or reset
```

Also add to the `AcademicYear` model:
```prisma
healthRecords  HealthRecord[]
```

Also add to the `User` model:
```prisma
recordedHealthRecords HealthRecord[] @relation("HealthRecordRecordedBy")
```

---

## 10. API Contracts

### Staff Side — Health Records

All endpoints require JWT — `REGISTRAR` or `SYSTEM_ADMIN`.

```
GET /api/students/:id/health-records
Authorization: Bearer <JWT>

Response 200:
{
  "healthRecords": [
    {
      "id":               1,
      "schoolYear":       "2026–2027",
      "assessmentPeriod": "EOSY",
      "assessmentDate":   "2027-03-20",
      "weightKg":         52.0,
      "heightCm":         158.0,
      "notes":            null,
      "recordedBy":       "Cruz, Regina",
      "createdAt":        "2027-03-20T08:00:00Z"
    }
    // ... more records
  ]
}
```

```
POST /api/students/:id/health-records
Authorization: Bearer <JWT>
Body: {
  schoolYearId:      1,
  assessmentPeriod:  "BOSY",
  assessmentDate:    "2026-06-10",
  weightKg:          48.5,
  heightCm:          155.0,
  notes:             "School nurse assisted"
}

Response 201: { "id": 5, ...record }
AuditLog: HEALTH_RECORD_ADDED

Duplicate check: if a BOSY or EOSY record already exists for this
applicant + schoolYear combination, returns:
422 Unprocessable Entity:
{ "message": "A BoSY record already exists for this learner for SY 2026–2027." }
```

```
PUT /api/students/:id/health-records/:recId
Authorization: Bearer <JWT>
Body: { weightKg, heightCm, assessmentDate, notes }

Response 200: { ...updated record }
AuditLog: HEALTH_RECORD_UPDATED
```

### Learner Portal

```
POST /api/learner/lookup
No Authorization header required
Rate-limited: 10 requests / 15 minutes / IP
Body: {
  "lrn":       "123456789012",
  "birthDate": "2014-03-12",
  "pin":        "473912"
}

Response 200: { "learner": { ... } }   ← see full payload above

Response 401 / 404:
{ "message": "The information you entered did not match our records. Please check your LRN, Date of Birth, and PIN." }
(Same message for all failure cases — never reveals which factor was wrong)

Response 403 — learner not yet enrolled:
{ "message": "Your enrollment is not yet finalized. The portal will be available once your enrollment is confirmed." }

Response 429:
{ "message": "Too many attempts. Please try again in 15 minutes." }
```

### Portal PIN Reset (Staff Only)

```
POST /api/students/:id/reset-portal-pin
Authorization: Bearer <JWT> — REGISTRAR or SYSTEM_ADMIN

Response 200:
{
  "pin": "847291"   ← raw 6-digit PIN, shown ONCE to registrar to print on slip
                       Never stored in plain text — DB saves only the bcrypt hash
}

AuditLog: PORTAL_PIN_RESET — "Registrar [name] reset portal PIN for LRN [lrn]"
```

> **Important:** The `pin` value in the reset response is returned **only once** at generation time. The registrar must immediately print it on the confirmation slip for the parent. After this API call, the raw PIN cannot be retrieved — the DB stores only the bcrypt hash.

---

## 11. Audit Logging

All staff-side actions on health records are written to `AuditLog`.

| Action | `actionType` | Description Template |
|---|---|---|
| Add new health record | `HEALTH_RECORD_ADDED` | `[user] added BoSY/EoSY health record for [learner name], SY [year] — Weight: [kg]kg, Height: [cm]cm` |
| Edit existing record | `HEALTH_RECORD_UPDATED` | `[user] updated health record #[id] for [learner name] — Changed: [fields]` |
| Reset portal PIN | `PORTAL_PIN_RESET` | `[user] reset portal PIN for LRN [lrn] — [learner name]` |

The Learner Portal lookup (`POST /api/learner/lookup`) does **not** generate an audit log entry — it is a public endpoint and logging all lookups would create excessive noise. Rate limiting provides the security boundary.

---

## 12. Data Privacy & RA 10173 Compliance

| Requirement | How It Is Met |
|---|---|
| **Informed consent** | RA 10173 consent captured on the BEEF at enrollment — covers health data collection for school purposes |
| **Purpose limitation** | Health records are collected for the purpose of DepEd SF8 reporting and nutritional monitoring — not shared with third parties |
| **Data minimization** | Only weight, height, assessment date, and period are stored. BMI and all derived classifications are computed at display time — not persisted |
| **Access control — staff** | JWT role check on all `/api/students/:id/health-records` endpoints |
| **Access control — learner** | LRN + Date of Birth + 6-digit PIN (three-factor). PIN stored as bcrypt hash — registrar cannot retrieve plain-text value. Rate-limited at 10 attempts / 15 min / IP |
| **PIN security** | `bcrypt.hashSync(pin, 10)` storage · `bcrypt.compare()` verification (constant-time) · PIN shown raw only once at enrollment, then only bcrypt hash is in the DB |
| **SPI fields excluded from learner portal** | 4Ps, IP, PWD data stripped server-side before response — never present in the API payload |
| **Grades excluded** | No grade data is stored in SIMS — consistent with purpose limitation and adviser instruction |
| **No delete via UI** | Health records are append-only — prevents tampering with the nutritional trend record |
| **Audit trail** | Every add/edit/PIN-reset creates an immutable AuditLog entry |

**Health data is Personal Information, not Sensitive Personal Information** under RA 10173 — weight and height are not among the enumerated SPI categories (which are: health conditions, sexual orientation, etc.). However, BMI classifications (Wasted, Obese) could be considered health-relevant and are handled with appropriate care — they are computed, not stored, and are shown to the learner as their own data per their RA 10173 right to access.

---

## 13. Component & File Structure

```
client/src/
├── pages/
│   ├── students/
│   │   ├── Index.tsx                  ← /students (directory)
│   │   └── Profile.tsx                ← /students/:id (5-tab profile)
│   └── learner/
│       └── LearnerPortal.tsx          ← /learner (self-service portal)
│
├── components/
│   ├── students/
│   │   ├── tabs/
│   │   │   ├── PersonalInfo.tsx       ← Tab 1
│   │   │   ├── AcademicHistory.tsx    ← Tab 2
│   │   │   ├── ApplicationRecord.tsx  ← Tab 3
│   │   │   ├── Classifications.tsx    ← Tab 4
│   │   │   └── HealthRecords.tsx      ← Tab 5
│   │   └── dialogs/
│   │       ├── AddHealthRecord.tsx    ← Add / Edit dialog
│   │       └── EditStudentRecord.tsx  ← Edit personal info
│   └── learner/
│       ├── LookupForm.tsx             ← LRN + DOB form
│       ├── PersonalInfoSection.tsx    ← Learner portal section 1
│       ├── EnrollmentSection.tsx      ← Learner portal section 2 + 3
│       └── HealthSection.tsx          ← Learner portal section 4
│
├── utils/
│   └── bmi.ts                         ← computeBmi(), computeHfa()
│
└── constants/
    └── whoGrowthReference.ts          ← WHO 2007 LMS lookup tables (BAZ + HAZ)

server/src/
├── routes/
│   ├── student.routes.ts              ← /api/students + health records + PIN reset
│   └── learner.routes.ts              ← /api/learner/lookup
├── controllers/
│   ├── studentController.ts
│   ├── healthRecordController.ts
│   ├── portalPinController.ts         ← generate PIN on enrollment, reset PIN
│   └── learnerPortalController.ts     ← lookup + three-factor verify + SPI field stripping
└── services/
    ├── portalPinService.ts            ← generatePortalPin(), bcrypt hash, enrollment hook
    └── learnerPortalService.ts        ← DB query + field whitelist
```

---

## 14. Acceptance Criteria

| # | Test |
|---|---|
| AC-34 | Registrar opens `/students/:id` and sees 5 tabs including "Health Records". |
| AC-35 | Registrar adds a BoSY health record — BMI and nutritional status are displayed correctly based on WHO BAZ reference. |
| AC-36 | Attempting to add a second BoSY record for the same learner and same school year returns a 422 error. |
| AC-37 | Adding or editing a health record creates an `AuditLog` entry with `HEALTH_RECORD_ADDED` or `HEALTH_RECORD_UPDATED`. |
| AC-38 | When a learner's status is set to ENROLLED, a 6-digit portal PIN is auto-generated and its bcrypt hash is saved to `Applicant.portalPin`. |
| AC-39 | The raw PIN is returned only once in the enrollment confirmation response — it is never retrievable again from the API. |
| AC-40 | Learner visits `/learner`, enters valid LRN + birthdate + PIN, and sees their personal info, enrollment history, and health records. |
| AC-41 | Learner portal response never includes 4Ps, IP, PWD, grades, exam scores, tracking number, or guardian contact. |
| AC-42 | Entering an incorrect LRN, birthdate, or PIN returns the same generic error message — no indication of which factor was wrong. |
| AC-43 | After 10 failed lookup attempts from the same IP within 15 minutes, the endpoint returns `429 Too Many Requests`. |
| AC-44 | A learner with `status = PENDING` or `APPROVED` (not yet ENROLLED) cannot access the portal — receives the enrollment-not-finalized message. |
| AC-45 | Registrar resets a learner's PIN — a new raw PIN is shown once, a new bcrypt hash is saved, and `PORTAL_PIN_RESET` is written to the audit log. |
| AC-46 | Learner portal BMI and nutritional status are computed using WHO BAZ — not the adult BMI cutoffs. |
| AC-47 | The Print / Save as PDF action in the learner portal renders the school name from `SchoolSettings` — never hardcoded. |
| AC-48 | A learner with no health records entered yet sees an empty state in the Health Records section with a note to contact the registrar. |

---

## Policy References

| Document | What It Governs |
|---|---|
| DepEd Order No. 13, s. 2017 | School Health and Nutrition Policy — mandates SF8 records for all learners |
| DepEd Order No. 017, s. 2025 | Revised Enrollment Policy — SIMS data collection and RA 10173 compliance |
| SF8 — Learner's Basic Health and Nutrition Report | Official DepEd form for weight, height, BMI, nutritional status — BoSY and EoSY |
| RA 10173 — Data Privacy Act of 2012 | Governs collection, access, and disclosure of personal and sensitive personal information |
| WHO 2007 Growth Reference for School-Age Children | BMI-for-Age and Height-for-Age Z-score tables — the classification standard used by DepEd SF8 |

---

*Document v1.1.0*
*System: School Admission, Enrollment & Information Management System*
*Module: Student Information Management System (SIMS) + Learner Self-Service Portal*
*Policy: DepEd Order No. 13, s. 2017 · DepEd Order No. 017, s. 2025 · SF8 · RA 10173 · WHO 2007 Growth Reference*
*Staff Access: JWT · Learner Access: LRN + Date of Birth + 6-digit PIN (three-factor, no login account)*
*Grades: Explicitly excluded · SPI fields: Hidden from learner portal*
*v1.1.0 change: Added 6-digit PIN as third access factor — bcrypt-hashed, issued at enrollment, registrar-resettable*
