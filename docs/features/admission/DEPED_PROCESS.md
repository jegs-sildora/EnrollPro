# DepEd Enrollment Process — Policy Reference
## School Admission, Enrollment & Information Management System

**Document Version:** 3.0.0
**Governing Policy:** DepEd Order No. 017, s. 2025 — *Revised Basic Education Enrollment Policy*
**Effective:** School Year 2025–2026 and all subsequent school years
**Supersedes:** DepEd Order No. 03, s. 2018 (Basic Education Enrollment Policy)
**Signed by:** Secretary Sonny Angara, June 13, 2025
**Scope:** All public and private secondary schools offering Grades 7 to 12 nationwide

**How this document is used:** This is the policy foundation for all five system modules. Every form field, workflow state, and database model in this system is traceable to a provision in the documents cited here. When in doubt about a process decision, consult this reference first.

---

## Table of Contents

**Policy Sections**
1. [Legal Basis & Policy Overview](#1-legal-basis--policy-overview)
2. [School Year Calendar Structure](#2-school-year-calendar-structure)
3. [The Two-Phase Enrollment Framework](#3-the-two-phase-enrollment-framework)
4. [Who Enrolls in Each Phase — Grade-Level Matrix](#4-who-enrolls-in-each-phase--grade-level-matrix)
5. [Enrollment by Learner Type](#5-enrollment-by-learner-type)
6. [Documentary Requirements — Complete Matrix](#6-documentary-requirements--complete-matrix)
7. [The Basic Education Enrollment Form (BEEF)](#7-the-basic-education-enrollment-form-beef)
8. [Enrollment Modes](#8-enrollment-modes)
9. [Senior High School Strand Selection (Grade 11)](#9-senior-high-school-strand-selection-grade-11)
10. [The Learner Reference Number (LRN)](#10-the-learner-reference-number-lrn)
11. [School Forms Reference](#11-school-forms-reference)
12. [Learner Information System (LIS) Protocols](#12-learner-information-system-lis-protocols)
13. [Special Cases & Edge Conditions](#13-special-cases--edge-conditions)
14. [Prohibited Practices](#14-prohibited-practices)
15. [Late Enrollment Policy](#15-late-enrollment-policy)
16. [End-of-Year Enrollment Reporting](#16-end-of-year-enrollment-reporting)

**System Design Implications**
- [A1. Two Admission Pathways — Open Admission vs. SCP](#a1-the-two-admission-pathways--a-critical-distinction)
- [A2. Pathway 1 — Open Admission (Regular Sections)](#a2-pathway-1--open-admission-regular-sections)
- [A3. Pathway 2 — Special Curricular Program (SCP) Admission](#a3-pathway-2--special-curricular-program-scp-admission)
- [A4. Grade 11 SHS — Special Program Admission](#a4-grade-11-shs--special-program-admission)
- [A5. System Module Design Implications — All Five Modules](#a5-system-module-design-implications--all-five-modules)
- [A6. Admission Process Timeline — Full Calendar View](#a6-admission-process-timeline--full-calendar-view)

---

## 1. Legal Basis & Policy Overview

### Primary Legal Bases

| Law / Order | Key Provision |
|---|---|
| **RA 10533** (Enhanced Basic Education Act of 2013) | Mandates free and compulsory K–12 basic education |
| **RA 7797** as amended by **RA 11480** | Fixes the school year: opens first Monday of June, ends March 31 |
| **RA 11909** (Permanent Validity of Civil Registry Documents Act) | Birth certificates have permanent validity; cannot be refused as expired |
| **RA 10173** (Data Privacy Act of 2012) | Learner personal data must be collected, stored, and processed with strict privacy safeguards |
| **RA 11510** (Alternative Learning Systems Act) | ALS learners are entitled to enrollment in formal education |
| **DepEd Order No. 017, s. 2025** | Revised Basic Education Enrollment Policy — the operative governing document |

### Core Policy Principles (DO 017, s. 2025)

1. **Universal Access** — All types of learners (school-age, OSCYA, learners with disabilities, IP learners) shall be accepted in any basic education institution upon presentation of minimum documentary requirements.
2. **No Collection of Fees** — Early registration, enrollment, and all related school forms are free. No voluntary or compulsory fees may be collected during any stage of the enrollment process.
3. **One-Time Document Submission** — A learner's PSA Birth Certificate is submitted **only once** for the entire K–12 journey. Schools record the PSA certificate number and retain it in the learner's permanent record — parents no longer re-submit it each year.
4. **Data Privacy** — All learner data collected is governed by RA 10173. Schools may not share, sell, or expose personal enrollment data beyond lawful purposes.
5. **No Withholding of Records** — Schools may **never** withhold a learner's academic records (SF9, SF10) due to unpaid fees or financial obligations.

---

## 2. School Year Calendar Structure

The school year structure is legally fixed under RA 7797 (as amended by RA 11480) and further specified in DepEd's annual School Calendar issuances.

### SY 2025–2026 Reference Dates

| Milestone | Date | Notes |
|---|---|---|
| **Class Opening** | June 16, 2025 | First Monday of June |
| **Brigada Eskwela** | ~June 9–13, 2025 | National Schools Maintenance Week preceding opening |
| **Christmas Break** | December 20, 2025 – January 4, 2026 | Fixed annually |
| **Graduation / Moving-Up** | ~March 2026 | School-determined within the calendar |
| **Class End** | March 31, 2026 | Legally fixed |
| **Summer Break** | April 1 – ~June 14, 2026 | |
| **Next SY Opening (SY 2026–2027)** | June 1, 2026 | First Monday of June 2026 |

### SY 2026–2027 Early Registration Dates

| Phase | Dates | Governed by |
|---|---|---|
| **Early Registration SY 2026–2027** | January 31 – February 27, 2026 | DepEd Order No. 17, s. 2025 |

> **System implication:** The system automatically calculates Phase 1 and Phase 2 dates from the year label when creating a new academic year, using the fixed DepEd calendar rules above. See the Academic Year configuration module in Settings Tab 2.

---

## 3. The Two-Phase Enrollment Framework

DepEd's enrollment is not a single event. It is a **two-phase process** separated by months, each with a distinct purpose, target population, and legal status.

```
CALENDAR YEAR                                     NEXT CALENDAR YEAR
─────────────────────────────────────────────────────────────────────────────
JAN          FEB         MAR–MAY     JUN              JUL–MAR
──────────────────────────────────────────────────────────────────────────────
[─── PHASE 1 ────]                  [─ PHASE 2 ─]    [CLASSES IN SESSION]
EARLY REGISTRATION               REGULAR ENROLLMENT
Last Sat Jan →                   ~1 week before      First Monday June →
Last Fri Feb                     class opening        March 31
(Pre-registration;              (Official enrollment
NOT official enrollment)         of record)
```

### Phase 1 — Early Registration

| Attribute | Detail |
|---|---|
| **Annual Window** | Last Saturday of January to last Friday of February |
| **SY 2026–2027 Dates** | January 31 – February 27, 2026 |
| **Who is Covered** | Incoming Grade 7, Grade 11, transferees to public schools, first-time ALS learners |
| **Who is NOT Covered** | Grades 8–10 and Grade 12 (they are pre-registered) |
| **Legal Status** | Pre-registration only — **not** official enrollment. Participation does not guarantee a slot. |
| **Primary Purpose** | Schools project resource needs: classrooms, teachers, learning materials, budget requests |
| **Extension Authority** | Schools Division Offices (SDOs) may extend the period for unforeseen circumstances |
| **Data Destination** | All early registration data is uploaded to the DepEd Learner Information System (LIS) |

### Phase 2 — Regular Enrollment

| Attribute | Detail |
|---|---|
| **Annual Window** | Approximately one week before the official opening of classes |
| **SY 2025–2026 Dates** | ~June 9–14, 2025 (coincides with Brigada Eskwela week) |
| **Who is Covered** | **All grade levels** — pre-registered and new entrants finalize enrollment |
| **Legal Status** | **Official enrollment of record** — learners become officially enrolled |
| **Purpose** | Establishes the official learner headcount; triggers section assignments |
| **LIS Action** | School records official enrollment in LIS Beginning of School Year (BOSY) facility |

> **Important Distinction:** A learner who completes Phase 1 (Early Registration) is **pre-registered**, not enrolled. They must still complete Phase 2 to be officially enrolled and assigned to a section.

---

## 4. Who Enrolls in Each Phase — Grade-Level Matrix

| Grade Level | Phase 1 (Early Registration) | Phase 2 (Regular Enrollment) | Form Required |
|---|---|---|---|
| **Grade 7** | ✅ Required (new JHS entrant) | ✅ Required (confirm/finalize) | BEEF |
| **Grade 8** | ❌ Pre-registered (no action) | ✅ Confirmation slip only | Annex C — Confirmation Slip |
| **Grade 9** | ❌ Pre-registered | ✅ Confirmation slip only | Annex C |
| **Grade 10** | ❌ Pre-registered | ✅ Confirmation slip only | Annex C |
| **Grade 11** | ✅ Required (new SHS entrant) | ✅ Required (confirm + strand) | BEEF |
| **Grade 12** | ❌ Pre-registered | ✅ Confirmation slip only | Annex C |
| **Transferees (Any Grade)** | ✅ If transferring to public | ✅ Required | BEEF + transfer documents |
| **Balik-Aral (Returnees)** | ✅ Covered in Phase 1 window | ✅ Required | BEEF + alternative docs |

**Pre-registered** = learners in Grades 8–10 and Grade 12 with an existing LRN in LIS who do not undergo Early Registration but **must** submit a confirmation slip during Phase 2 to be officially enrolled.

> **System implication for Sectioning module:** The distinction between Grade 7/11 (who need section assignment) and pre-registered grades (who already have a section from the prior year) drives the section management workflow. Pre-registered students confirm their existing section; new entrants are assigned.

---

## 5. Enrollment by Learner Type

### 5.1 Incoming Grade 7 (JHS New Entrants)

**Who qualifies:**
- Learners who have completed a DepEd-accredited Grade 6 program
- Learners who have passed the PEPT or A&E Test as a Grade 6 substitute

```
PHASE 1 — EARLY REGISTRATION (Jan–Feb)
  └─ Parent presents PSA BC + Grade 6 SF9 + BEEF
     School logs pre-registration in LIS Early Registration facility
     Status: PRE-REGISTERED

PHASE 2 — REGULAR ENROLLMENT (~1 week before June opening)
  └─ Parent confirms → School assigns Grade 7 section → LIS BOSY
     Status: OFFICIALLY ENROLLED
```

**Documents:**

| Document | Status |
|---|---|
| PSA/NSO Birth Certificate | Required (once-only verification) |
| Grade 6 SF9 (Report Card) | Required |
| Basic Education Enrollment Form (BEEF) | Required |
| PEPT / A&E Test Result | Only if no Grade 6 SF9 |

---

### 5.2 Continuing Grades 8, 9, 10 (Pre-Registered)

Automatically pre-registered in LIS. Phase 1 not applicable.

```
PHASE 2 ONLY — REGULAR ENROLLMENT
  └─ Parent/learner submits Confirmation Slip (Annex C)
     School validates LIS record and assigns section
     Status: OFFICIALLY ENROLLED
```

---

### 5.3 Incoming Grade 11 (SHS New Entrants)

**Additional complexity vs. Grade 7:** Strand/track selection with eligibility implications.

```
PHASE 1 — EARLY REGISTRATION (Jan–Feb)
  └─ Parent presents Grade 10 SF9 + PSA BC + BEEF (includes strand selection)
     School verifies JHS completion; logs in LIS Early Reg
     Status: PRE-REGISTERED

PHASE 2 — REGULAR ENROLLMENT (~1 week before June opening)
  └─ Parent confirms; school validates strand capacity; assigns section
     Status: OFFICIALLY ENROLLED
```

**Documents:**

| Document | Status |
|---|---|
| Grade 10 SF9 (Report Card) | Required |
| BEEF | Required (includes strand/track selection) |
| PSA Birth Certificate | Required (once-only if new to school) |
| Grade 10 Certificate of Completion | Recommended |
| Good Moral Certificate | Not required by DepEd for public schools |

---

### 5.4 Continuing Grade 12 (Pre-Registered)

Same simplified process as Grades 8–10. Phase 2 only.

> **SHS Note:** SHS has two semesters. Grade 12 2nd Semester enrollment is a separate LIS facility (December–January window). The system's Academic Year configuration must account for this second enrollment window.

---

### 5.5 Transferees (All Grade Levels)

Key rules:
- Schools **cannot deny enrollment** due to unpaid fees at a previous school
- **LRN does not change** upon transfer — the same 12-digit LRN follows the learner
- Receiving school initiates SF10 request via LIS Transfer facility

**Documents:**

| Document | Status |
|---|---|
| BEEF | Required |
| SF9 (Report Card) | Required |
| PSA Birth Certificate | Required if not already on file |
| Certification Letter | Alternative if SF9 unavailable |
| LRN | Required (validated against LIS) |
| Affidavit of Undertaking | Only if private → public with unpaid fees |

---

### 5.6 Balik-Aral (Returning Learners)

Learners returning after at least one year out of school. Protected under DO 017, s. 2025 — must not be turned away due to missing records.

**Documents (flexible):** SF9 (last report card) · PSA BC (if not on file) · Any credible document proving last grade completed.

Phase 1 window applies. Must complete Phase 2 for official enrollment.

---

### 5.7 Out-of-School Children, Youth & Adults (OSCYA)

DO 017, s. 2025 mandates acceptance in any basic education institution. May present alternative documentation. Follows same process as transferees or Balik-Aral. If records entirely unavailable, SDO coordinates PEPT assessment for grade placement.

---

## 6. Documentary Requirements — Complete Matrix

Under **DO 017, s. 2025**, documents are presented for **verification only** — not collected from learners (except the one-time PSA Birth Certificate submission).

| Learner Type | PSA BC | SF9 | BEEF | Confirmation Slip | SF10 |
|---|---|---|---|---|---|
| Incoming Grade 7 | ✅ Once-only | ✅ Grade 6 | ✅ | — | ❌ |
| Grade 8–10 (continuing) | ❌ On file | — | — | ✅ | ❌ |
| Incoming Grade 11 | ✅ Once-only | ✅ Grade 10 | ✅ | — | ❌ |
| Grade 12 (continuing) | ❌ On file | — | — | ✅ | ❌ |
| Transferee | ✅ If not on file | ✅ Latest | ✅ | — | School-requested |
| Balik-Aral | ✅ If not on file | ✅ Last (physical) | ✅ | — | SDO-coordinated |
| OSCYA | ✅ | Alternative docs | ✅ | — | If available |

---

## 7. The Basic Education Enrollment Form (BEEF)

The BEEF is the official DepEd enrollment document under DO 017, s. 2025.

### BEEF Section Map → System Field Mapping

| BEEF Section | Fields | System Model |
|---|---|---|
| **Learner Identity** | Last Name, First Name, Middle Name, Suffix, Sex, Date of Birth, Place of Birth | `Applicant` model personal fields |
| **Reference Numbers** | PSA Birth Certificate Number, LRN | `Applicant.lrn` |
| **Special Classification** | Disability type | `Applicant.isPersonWithDisability`, `disabilityType` |
| **IP Status** | IP learner flag, ethnolinguistic group | `Applicant.isIndigenousPeople`, `ipCommunity` |
| **Address** | Home address, barangay, municipality, province | `Applicant.address*` fields |
| **Parent / Guardian** | Name, relationship, contact number | `Applicant.guardian*` fields |
| **School Information** | Grade level, strand/track (G11), learning modality | `Applicant.gradeLevelId`, `strandId` |
| **Certification** | Parent/guardian signature | `Applicant.privacyConsentGiven` |

The BEEF fields are also captured in the system's online admission form (for applicants who apply via `/apply`) and the F2F admission form (for walk-in applicants processed by the registrar at `/f2f-admission`).

---

## 8. Enrollment Modes

DO 017, s. 2025 provides three equally valid enrollment modes. The system supports all three:

### Mode A — In-Person Enrollment (F2F Channel)

Parent/guardian visits the school in person. Registrar enters the application via `/f2f-admission`. Records stored with `admissionChannel: F2F`.

### Mode B — Online Enrollment

Parent/guardian submits via the school's online portal at `/apply` (when `enrollmentOpen = true`). Records stored with `admissionChannel: ONLINE`.

### Mode C — Remote / Alternative Enrollment

Documents submitted via dropbox, email, or a designated school representative. Registrar enters the data via `/f2f-admission` using the physical form, checking the "physical consent confirmed" box. Stored as `admissionChannel: F2F`.

---

## 9. Senior High School Strand Selection (Grade 11)

### Tracks Under DM 012, s. 2026 (Strengthened SHS Curriculum)

| Track | Strands / Clusters | Notes |
|---|---|---|
| **Academic** | HUMSS, ABM, GAS | No entrance exam for regular Academic sections |
| **Academic — STEM** | STEM | Requires Grade 10 Science + Math ≥ 85; may require additional school-level assessment |
| **TechPro (formerly TVL)** | ICT, HospTour, HA, AFA, Industrial Arts, and others | Practical/aptitude screening varies by school |

> **School-agnostic design rule:** The strands offered at a given school are configured in Settings → Tab 3 → Strands. The system does not hardcode any strand list. A school that offers only Academic + STEM configures only those strands. The admission form and the section management module both read from the database.

### Guidance Counselor Involvement

Schools are encouraged to conduct career advocacy counseling before or during Phase 1 to help Grade 11 applicants select the most appropriate strand. This is outside the system's scope but can be documented in the Applicant record's notes field.

---

## 10. The Learner Reference Number (LRN)

The LRN is a **permanent, nationally unique 12-digit identifier** assigned to every learner in the Philippine basic education system.

| Attribute | Detail |
|---|---|
| **Format** | 12-digit numeric string, left-padded with zeros if needed |
| **Assignment** | Assigned once; never changes throughout K–12 |
| **Does not change on** | Transfer · Grade advancement · SCP admission · School year change |
| **Source of truth** | DepEd Learner Information System (LIS) |
| **First-time issuance** | Assigned by the school when a learner first enrolls without an LRN |
| **Duplicate prevention** | School must validate against LIS before creating a new LRN |

> **System rule:** The `Applicant.lrn` field is a `@unique` constraint in the Prisma schema and is **immutable** after creation. The SIMS student profile displays LRN as a read-only field even in edit mode.

---

## 11. School Forms Reference

| Form | Old Name | Description | Relevance to System |
|---|---|---|---|
| **SF1** | Class Record / Enrollment Register | Daily attendance register; official enrollment headcount | Out of scope |
| **SF2** | Daily Attendance Report | Monthly attendance summary | Out of scope |
| **SF9** | Report Card (formerly Form 138) | Quarterly and final grades; primary credential for enrollment | Referenced in documentary requirements; general average stored in `Applicant.generalAverage` |
| **SF10** | Permanent Academic Record (formerly Form 137) | Complete grade history; requested by receiving schools | Referenced in transfer workflow documentation |
| **BEEF** | Basic Education Enrollment Form | The enrollment form filled out by each learner | Directly maps to `Applicant` model |
| **Annex C** | Confirmation Slip | Used by pre-registered continuing learners | Recorded in system as enrollment confirmation |

---

## 12. Learner Information System (LIS) Protocols

The DepEd LIS is the national registry of all K–12 learners. This system does **not** integrate with or replace the LIS. It serves as the school's local intake, processing, and records management system. All LIS uploads remain the registrar's responsibility through the DepEd LIS portal.

Key LIS facilities referenced in enrollment workflows:

| LIS Facility | When Used |
|---|---|
| **Early Registration** | Phase 1 — recording Grade 7, Grade 11, transferee pre-registrations |
| **BOSY (Beginning of School Year)** | Phase 2 — official enrollment record for all grade levels |
| **Transfer/Tracking** | When receiving a transferee from another school |
| **EOSY (End of School Year)** | After March 31 — final enrollment counts, movers, dropouts |
| **SHS 2nd Semester** | December–January — Grade 12 SHS second semester enrollment |

---

## 13. Special Cases & Edge Conditions

### Missing PSA Birth Certificate

**Policy:** Schools shall not refuse enrollment due to a missing PSA Birth Certificate. If unavailable at enrollment time, the school grants a grace period until **October 31** of the school year.

**System implication:** The `privacyConsentGiven` flag is separate from document completeness. The applicant's status can be set to APPROVED with a note that PSA BC is pending.

### Previously Enrolled Learner — LRN Lookup

When a returning learner's LRN is entered in the admission form, the system checks for an existing `Applicant` record and pre-fills available fields. This prevents duplicate records and ensures the same LRN is used.

### Learner Enrolled at Two Schools

Not permitted under LIS rules. The system's LRN uniqueness constraint per academic year enforces this — a learner already enrolled in the active AY cannot submit a second application.

### Section Capacity Exceeded

The system enforces `maxCapacity` as a hard limit per section. The registrar may not assign more students than the configured capacity. If all sections for a grade are full, the registrar must create a new section before enrollment can proceed.

---

## 14. Prohibited Practices

Under DO 017, s. 2025 and RA 10173, the following are prohibited and must not be facilitated by this system:

| Prohibited Practice | Policy Basis |
|---|---|
| Requiring entrance examinations for regular (non-SCP) sections | DO 017, s. 2025 — open admission for regular sections |
| Collecting fees during enrollment | DO 017, s. 2025 — all enrollment is free |
| Withholding academic records (SF9, SF10) due to unpaid fees | DO 017, s. 2025 |
| Requiring Good Moral Certificate from public school applicants | DO 017, s. 2025 |
| Collecting original PSA Birth Certificates | DO 017, s. 2025 — verification only; once-only recording |
| Sharing or selling learner personal data | RA 10173 |
| Denying enrollment to an IP learner, PWD learner, or OSCYA | DO 017, s. 2025 — universal access |

> **System enforcement:** The online admission form and F2F form do not include a fee field or a "Good Moral Certificate" checkbox. These are intentionally excluded to prevent facilitating prohibited practices.

---

## 15. Late Enrollment Policy

Learners who attempt to enroll after the school year has opened are still accepted.

| Scenario | Policy |
|---|---|
| Learner enrolls during the first quarter (June–August) | Accepted; marks late enrollment date in LIS |
| Learner enrolls during 2nd quarter (September–October) | Accepted; SDO endorsement may be required |
| Learner enrolls after October 31 | Accepted at principal's discretion with SDO coordination |

**System implication:** The enrollment gate (`enrollmentOpen`) toggles the public portal only. The registrar can always process enrollment via the F2F admission route regardless of the gate state.

---

## 16. End-of-Year Enrollment Reporting

At the end of the school year (after March 31), the registrar reports:

| Report | What it Covers | LIS Facility |
|---|---|---|
| **EOSY Enrollment Data** | Final headcount of enrolled, transferred, dropped, and promoted learners | EOSY facility |
| **Cohort Tracking** | Movement of learners from one grade to the next | LIS internal |
| **SCP Program Report** | Count of SCP students by program | Division-level report |

The system's Audit Log and SIMS module provide the source data for these reports. Export functions are available in the audit log (for SYSTEM_ADMIN) to assist the registrar in compiling LIS uploads.

---

---

# SYSTEM DESIGN IMPLICATIONS

---

## A1. The Two Admission Pathways — A Critical Distinction

Before any system design decision is made, understand that DepEd public secondary schools operate under **two fundamentally different admission pathways** that coexist within the same school year:

```
APPLICANT ARRIVES
        │
        ▼
  Is the applicant applying for
  a Special Curricular Program (SCP)?
        │
    YES │                     NO │
        ▼                        ▼
 SCP ADMISSION PATH      OPEN ADMISSION PATH
 (exam / audition /      (submit documents →
  tryout / screening)     verified → enrolled)
        │                        │
        ▼                        ▼
 PASS → enroll          No exam, no test,
 FAIL → rejected        no score threshold
```

These two paths have **completely different workflows, timelines, and document requirements.** A system that treats them as identical will fail to accurately capture the admission process.

> **School-agnostic rule:** Whether a school offers any SCP programs at all is a runtime configuration, not a hardcoded assumption. A school that offers no SCP programs will see only the Open Admission path in the system. A school that offers STE and SPA will see both. Configure via Settings → Tab 3 → SCP Programs.

---

## A2. Pathway 1 — Open Admission (Regular Sections)

### Grade 7 Regular Sections — No Exam, No Barrier

For learners enrolling in regular (non-SCP) Grade 7 sections, DO 017, s. 2025 mandates open, barrier-free admission. No school may require an entrance examination, interview, or any assessment instrument for regular section placement.

**Registrar workflow in the system:**
```
Phase 1 Application received (ONLINE or F2F)
  └─ Status: PENDING
       │
       ▼
Registrar verifies documents in /applications detail view
  └─ Status: APPROVED (+ section assigned)
       │
       ▼
Phase 2 confirmation → Status: ENROLLED
```

### Grade 11 Non-Exam Tracks — Grade Criteria Only

For Grade 11 applicants in non-STEM tracks (HUMSS, ABM, GAS, TechPro clusters), entry is based on Grade 10 SF9 grades. No entrance examination. Minimum grade criteria per DepEd are low or absent for most tracks.

---

## A3. Pathway 2 — Special Curricular Program (SCP) Admission

### Overview

DepEd authorizes public secondary schools to conduct competitive admission assessments for Special Curricular Programs (SCPs). These serve learners with specific gifts, talents, and aptitudes. Unlike regular sections, SCP placement requires a qualifying assessment.

**Legal basis:** DepEd Memorandum No. 149, s. 2011 — Special Curricular Programs in JHS

> **School-agnostic design rule:** The SCP programs a school offers are configured in Settings → Tab 3 → SCP Programs. A school with no SCP programs configured sees no SCP fields in the admission form and no SCP columns in the applications inbox. All SCP-related UI is conditional on the school's configuration.

### The Six Official DepEd SCPs for JHS

#### STE — Science, Technology, and Engineering

| Attribute | Detail |
|---|---|
| **Admission Method** | Written entrance exam — standardized and administered division-wide |
| **Exam Scope** | Science, Mathematics, English, Abstract/Logical Reasoning |
| **Exam Coordinator** | Schools Division Office (SDO) — not individual schools |
| **Cut-off Score** | Division-determined; typically top percentile of examinees |
| **Section Capacity** | One STE class per grade level (maximum 40–45 students) |

#### SPA — Special Program in the Arts

| Attribute | Detail |
|---|---|
| **Art Fields** | Visual Arts · Music · Theatre Arts · Dance Arts · Media Arts · Creative Writing |
| **Admission Method** | Written qualifying exam + audition + interview (all on the same day) |
| **Results Timeline** | Released approximately one week after assessment day |

#### SPS — Special Program in Sports

| Attribute | Detail |
|---|---|
| **Admission Method** | Physical skills assessment / tryout by sports coaches |
| **No Written Exam** | Skills-based only |
| **Additional** | Medical clearance required in most divisions |

#### SPJ — Special Program in Journalism

| Attribute | Detail |
|---|---|
| **Admission Method** | SPJQE written exam + interview |
| **Selection** | Top 35 students admitted; combined score + interview |
| **Recommendation** | Required from Grade 6 paper adviser or English teacher |

#### SPFL — Special Program in Foreign Language

| Attribute | Detail |
|---|---|
| **Languages** | Spanish · Japanese · French · German · Chinese (Mandarin) · Korean (school configures which are offered) |
| **Admission Method** | NAT English score screening — no separate exam |
| **No Tryout/Audition** | Document-based entry only |

#### SPTVE — Special Program in Technical-Vocational Education

| Attribute | Detail |
|---|---|
| **Admission Method** | Aptitude test or practical skills demo — school-determined |
| **No Standardized National Exam** | Each school/SDO sets its own assessment |

### Complete SCP Assessment Matrix

| SCP | Written Exam | Audition/Tryout | Interview | NAT Score |
|---|---|---|---|---|
| STE | ✅ Division-wide | ❌ | Sometimes | ❌ |
| SPA | ✅ Qualifying | ✅ Per art field | ✅ | ❌ |
| SPS | ❌ | ✅ Sports tryout | ❌ | ❌ |
| SPJ | ✅ SPJQE | ❌ | ✅ | ❌ |
| SPFL | ❌ | ❌ | ❌ | ✅ English NAT |
| SPTVE | School-determined | School-determined | ❌ | ❌ |

### SCP Workflow States in the System

```prisma
enum ApplicationStatus {
  PENDING          // Application received; awaiting registrar review
  EXAM_SCHEDULED   // Registrar has set the assessment date
  EXAM_TAKEN       // Applicant appeared and completed the assessment
  PASSED           // Met cut-off; equivalent to APPROVED; ready for section assignment
  FAILED           // Did not meet cut-off; may be offered regular section
  APPROVED         // Verified and assigned to section (open admission path)
  REJECTED         // Definitively rejected
  ENROLLED         // Officially enrolled and section confirmed
}
```

---

## A4. Grade 11 SHS — Special Program Admission

### Grade 11 STEM — Criteria + School-Level Assessment

**DepEd national minimum criteria for STEM:**

| Criterion | Minimum |
|---|---|
| Final Grade in Science (Grade 10) | 85 and above |
| Final Grade in Mathematics (Grade 10) | 85 and above |
| Career Assessment Exam — STEM subtest | Percentile rank 86 and above |

Schools may add a placement examination and/or interview on top of the national criteria. The system supports this via the `ScpProgram.requiresInterview` flag and the assessment workflow.

### Grade 11 Non-STEM — Open to Grade 10 Completers

| Track | Admission | System Action |
|---|---|---|
| Academic — HUMSS | Verify Grade 10 SF9 | Approve + assign section (open path) |
| Academic — ABM | Verify Grade 10 SF9 | Approve + assign section |
| Academic — GAS | Verify Grade 10 SF9 | Approve + assign section |
| TechPro clusters | Verify Grade 10 SF9 | Approve + assign section |

---

## A5. System Module Design Implications — All Five Modules

### Module 1 — Admission (Online + F2F)

**Key policy facts that drive design:**
- Two admission channels (ONLINE and F2F) produce identical `Applicant` records. Only `admissionChannel` and `encodedById` differ.
- The school configures which channels are active (`SchoolSettings.admissionChannels`). A school that does not offer online admission disables the public portal entirely.
- SCP options in the admission form are loaded dynamically from `GET /api/scp-programs`. Schools configure only the SCPs they offer; the form shows only those. No SCP list is hardcoded.
- The online portal is gated by `enrollmentOpen`. The F2F route is never gated — registrars always have access.
- Privacy notice text (RA 10173) uses `SchoolSettings.schoolName`, `division`, and `region` — no hardcoded school name.

**`admissionChannel` stored in `Applicant`:**
```prisma
enum AdmissionChannel {
  ONLINE   // submitted via /apply
  F2F      // entered by registrar at /f2f-admission
}
```

### Module 2 — Enrollment Management (Registrar Only)

**Key policy facts that drive design:**
- Only the Registrar (and System Admin) can process applications, assign sections, and confirm enrollment. Teachers have no access to this module.
- The two-path workflow (open admission vs. SCP) must be visually distinguished in the `/applications` inbox.
- Section assignment during enrollment must respect `maxCapacity` and use a `FOR UPDATE` row lock to prevent over-enrollment.
- Pre-registered students (Grades 8–10, 12) can be enrolled directly without going through the full application workflow — they submit a confirmation slip and are assigned to a section.
- The enrollment gate (`enrollmentOpen`) controls the public portal only. F2F enrollment is always open.

**Status machine:**
```
PENDING → EXAM_SCHEDULED → EXAM_TAKEN → PASSED → APPROVED → ENROLLED   (SCP path)
PENDING → APPROVED → ENROLLED                                            (open path)
PENDING → REJECTED                                                       (either path)
```

### Module 3 — Student Information Management System (SIMS)

**Key policy facts that drive design:**
- A learner's LRN is **permanent and immutable**. It must be displayed as read-only in the SIMS profile edit form.
- PSA Birth Certificate is submitted only once. The system records the PSA certificate number, not the physical document.
- Academic records (SF9, SF10) must never be withheld — the system enforces this by having no fee field and no "hold records" functionality.
- The SIMS must support all learner types: New Enrollee, Transferee, Balik-Aral, Continuing, OSCYA.
- IP status, 4Ps beneficiary status, and PWD status are sensitive classifications collected for DepEd planning purposes only. They are never displayed in filterable public-facing views.
- Learner history across multiple academic years must be preserved in `Enrollment` records — the system never deletes historical enrollment data.
- All edits to student records create an `AuditLog` entry with `STUDENT_RECORD_UPDATED` listing changed field names — this satisfies RA 10173 accountability requirements.

**LRN immutability enforcement (both backend and frontend):**
```ts
// Backend: the lrn field is excluded from the update schema
// const updateSchema = admissionSchema.omit({ lrn: true });

// Frontend: LRN is rendered as a read-only display, not an input
<p className="font-mono text-sm">{student.lrn}</p>  // Not an <input>
```

### Module 4 — Teacher Management

Teachers in this system are NOT system users. They do not have login accounts and cannot access the system. Teacher profiles are created and managed by the Registrar and System Admin primarily for the purpose of assigning them as advisers to sections.

- **Teacher Profile:** Includes name, employee ID, contact number, and specialization.
- **Section Assignment:** Each section in Module 5 must be assigned an advising teacher from the teacher directory.
- **No System Access:** All enrollment-related actions, student record management, and sectioning are performed by the REGISTRAR or SYSTEM_ADMIN.

---

### Module 5 — Grade Level & Sectioning Management

**Key policy facts that drive design:**
- Grade levels, strands, and SCP programs are configured **per academic year**, not globally. A new academic year may offer different strands or discontinue an SCP.
- Section names are school-defined (e.g., "Rizal", "Bonifacio") — no hardcoded naming convention.
- Maximum section capacity defaults to 40 but is configurable per section. DepEd does not mandate a specific class size for all schools; the system allows any value.
- Grade levels that `requiresEarlyReg = true` (Grade 7, Grade 11, and transferees) must have their sections ready before the Phase 1 Early Registration window opens.
- Pre-registered students (Grades 8–10, 12) are assigned to sections during Phase 2. Section assignment for these students may be automated or manual.
- SCP sections may be designated by setting `Section.scpCode` — e.g., a "Grade 7 STE" section. This is informational only; the system does not enforce SCP section exclusivity.
- Section deletion is permanently blocked if any `Enrollment` record references it. The UI shows how many enrolled students must be reassigned before deletion is allowed.

**Dynamic grade level loading:**
```ts
// Grade levels are NEVER hardcoded in any dropdown, form, or filter
// They are always loaded from the active AY:
GET /api/grade-levels         // public (admission form)
GET /api/grade-levels/all     // authenticated (registrar tools)
```

### Cross-Module: School-Agnostic Configuration

Every school-specific value is a runtime setting stored in `SchoolSettings` and `AcademicYear`:

| What varies per school | Where configured | System reads from |
|---|---|---|
| School name | Settings Tab 1 | `SchoolSettings.schoolName` |
| School ID, Division, Region | Settings Tab 1 | `SchoolSettings.schoolId/division/region` |
| Logo and accent color | Settings Tab 1 | `SchoolSettings.logoUrl` + `colorScheme` |
| Grade levels offered | Settings Tab 3 | `GradeLevel` table for active AY |
| Strands and tracks | Settings Tab 3 | `Strand` table for active AY |
| SCP programs offered | Settings Tab 3 | `ScpProgram` table for active AY |
| Admission channels | Settings Tab 1 | `SchoolSettings.admissionChannels` |
| Enrollment phase dates | Settings Tab 2 | `AcademicYear.phase1Start/End`, `phase2Start/End` |

No component, controller, or email template contains a hardcoded school name, grade level name, strand name, or SCP code.

---

## A6. Admission Process Timeline — Full Calendar View

```
CALENDAR YEAR (during active school year)              NEXT CALENDAR YEAR
──────────────────────────────────────────────────────────────────────────────
NOV–DEC             JAN–FEB              MAR–APR         MAY–JUN
────────────────────────────────────────────────────────────────────────────
[SCP ANNOUNCEMENTS] [EARLY REGISTRATION] [SCP EXAMS &   ] [REGULAR ENROLLMENT]
Schools announce:   Phase 1 (DO 017):    RESULTS:          Phase 2 (DO 017):
- STE exam date     G7 + G11 applicants  STE written exam   All grade levels
- SPA audition      submit BEEF +        SPA audition        confirm enrollment
- SPS tryout date   documents via        SPS tryout          Section assignment
- SPJ SPJQE date    ONLINE or F2F        SPJ SPJQE exam      Enrollment gate
- SPFL NAT check    Pre-registration     Results released     opens online
                    (not yet enrolled)   PASSED → APPROVED   Classes open June
                                         FAILED → Alt offer
```

**System gate states across the timeline:**

| Period | `enrollmentOpen` | What it affects |
|---|---|---|
| NOV–DEC | Typically OFF | Online portal at `/apply` shows `/closed` page |
| JAN–FEB (Phase 1) | ON | Public `/apply` portal accepts Early Registration applications |
| MAR–MAY (SCP Processing) | Registrar-discretion | F2F always open; online may stay ON or close |
| JUN (Phase 2) | ON briefly | Confirmation period; online may reopen for late entrants |
| Classes in session | Typically OFF | Walk-in (F2F) only; online portal closed |

---

*Document v3.0.0*
*System: School Admission, Enrollment & Information Management System*
*Modules: Admission (Online + F2F) · Enrollment Management · SIMS · Teacher Management · Grade Level & Sectioning Management*
*Policy basis: DepEd Order No. 017, s. 2025 · DM 012, s. 2026 · DM 149, s. 2011 · RA 10173 · RA 7797 as amended by RA 11480*
*School-agnostic: all school-specific values (name, grade levels, strands, SCP programs) are runtime-configurable*