# EnrollPro vs. School Procedures: Alignment Analysis

**Scope:** Verification of EnrollPro system architecture, data structures, and user flows against documented school procedures for a public Junior High School.  
**Date of analysis:** May 20, 2026  

---

## 1. Differentiated Forms for Intake

### School procedure
- **Full Enrollment Form (BEEF):** Used exclusively for Transferees and incoming Grade 7 students (first-time entrants to the school).
- **Confirmation Slip:** A shorter document used for continuing/returning learners (e.g., Grade 8 → 9). They do not fill out the full form again.

### Evidence found in EnrollPro

| Evidence | Location |
|---|---|
| `IntakeMethod` enum: `BEEF_FULL` \| `CONFIRMATION_SLIP` | `server/prisma/schema.prisma` line 966-968 |
| `intakeMethod IntakeMethod @default(BEEF_FULL)` on `EnrollmentApplication` | `schema.prisma` line 382 |
| Online portal routes returning learners into `ReturningLearnerFlow` component, distinct from the full BEERF form | `client/src/features/admission/pages/online-enrollment/Index.tsx` |
| `IntakeChoice` UI card separates "Incoming Grade 7 / Transferees / Balik-Aral" vs. "Returning Learners" | `client/src/features/admission/pages/online-enrollment/components/IntakeChoice.tsx` |
| Digital "Confirmation Wall" — a short portal flow for `CONTINUING` learners that does **not** re-collect biographical data | `client/src/features/learner/components/ConfirmationWall.tsx` |
| `isConfirmationSlipReceived` boolean on `ApplicationChecklist` | `schema.prisma` line 500 |
| BEEF Annex 2 submission (Phase 2) explicitly pre-populates profile for returning learners, eliminating redundant data entry | `diagrams/Learner_Level_1_DFD.txt` P5.0 |
| Registrar workflow docs confirm: "Returning Grades 8-10 complete **Confirmation Slip** and SF9 validation" | `docs/features/enrollment/REGISTRAR_WORKFLOW.md` section 2.2 |

### Verdict: ✅ ALIGNED

EnrollPro fully supports the two distinct intake paths:

- **New / Transferee path:** Full BEERF → BEEF Annex 2 (multi-step form collecting all biographical, family, and previous school data). Tracked as `BEEF_FULL`.
- **Continuing/Returning path:** Learner accesses the self-service Confirmation of Return flow (Confirmation Wall). No full form is shown; only confirmation intent and TLE choices (for Grade 9) are collected. The physical checklist item `isConfirmationSlipReceived` records that the slip was presented. Tracked as `CONFIRMATION_SLIP`.

The `learnerType` distinction (`NEW_ENROLLEE`, `TRANSFEREE` vs. `CONTINUING`, `RETURNING`) drives which path is offered.

---

## 2. Assessment & Confirmation Workflow (Listing → Assessment → Flagging → Final Confirmation)

### School procedure
1. **Listing:** Initial name gathering of incoming learners.
2. **Reading Assessment:** Mandatory reading assessment conducted by teachers.
3. **Flagging:** Specific procedures for learners identified as non-readers or struggling readers.
4. **Final Confirmation:** Enrollment is only finalized when a teacher signs/confirms a slip after all steps are complete.

### Evidence found in EnrollPro

| Evidence | Location |
|---|---|
| `ReadingProfileLevel` enum: `INDEPENDENT`, `INSTRUCTIONAL`, `FRUSTRATION`, `NON_READER` | `schema.prisma` line 827-831; `shared/src/constants/index.ts` |
| `readingProfileLevel`, `readingProfileAssessedAt`, `readingProfileAssessedById` fields on `EnrollmentApplication` | `schema.prisma` lines 372-375 |
| Enrollment table exposes reading profile as a column, blocks progression until it is set | `client/src/features/enrollment/pages/Index.tsx` lines 1104, 1670 |
| A dedicated "Update Reading Profile" dialog on the enrollment manager page | `enrollment/pages/Index.tsx` line 922 |
| `distributeEquitably` engine separates `FRUSTRATION`-level learners into their own group when distributing sections heterogeneously | `server/src/features/enrollment/services/sectioning-engine.service.ts` line 580+ |
| `isConfirmationSlipReceived` on the `ApplicationChecklist` is one of the required items before finalization | `schema.prisma` line 500; `early-registration.lifecycle.controller.ts` enroll function |
| Enrollment finalization requires a complete `ApplicationChecklist` with all mandatory flags including confirmation slip receipt | `early-registration.lifecycle.controller.ts` |

### Verdict: ⚠️ PARTIALLY ALIGNED — one gap identified

**What is aligned:**
- Steps 2, 3, and 4 are handled:
  - **Reading Assessment:** The `ReadingProfileLevel` field is a first-class field on every enrollment application, with four levels including `NON_READER` and `FRUSTRATION`. It is encoded by the registrar/teacher after Brigada Pagbasa.
  - **Flagging (non-reader / struggling reader):** `NON_READER` and `FRUSTRATION` levels are distinct enum values. The sectioning engine specifically segregates `FRUSTRATION` readers to distribute them equitably across sections rather than concentrating them. The enrollment table flags records missing this field.
  - **Final Confirmation:** `isConfirmationSlipReceived` must be checked before finalization, and `readingProfileAssessedById` records which teacher performed the assessment.

**Gap — Step 1 (Listing):**
- The school's initial "listing" phase (physical name-gathering before forms are submitted) has no dedicated system state or flow. Learners enter the system only once a BEERF or BEEF form is submitted (status `SUBMITTED_BEERF` or `PENDING_REVIEW`). There is no pre-registration "list" step that captures just a name and grade level.

**Impact:** Low for digital-first schools. However, if the school conducts a listing drive where only names and grade levels are written down before parents return with documents, there is no matching queue or placeholder record in EnrollPro for this stage.

**Recommendation to close the gap:**
Add a lightweight "Pre-Listing" record type (a minimal `EnrollmentListing` model with `firstName`, `lastName`, `gradeLevel`, `dateCollected`, and a `status: LISTED | CONVERTED` flag). When the parent later submits a BEERF/BEEF, the listing record is matched by LRN or name and promoted. This mirrors how school clerks operate without requiring the full form upfront.

**Secondary gap — Reading Assessment UI for teachers:**
The current reading profile update is performed by the **registrar** through the enrollment manager UI. If the school expects **teachers** (not the registrar) to record reading levels directly, there is no teacher-facing interface to do so. The `TEACHER` role currently has limited, read-only access paths.

**Recommendation:** Add a teacher-facing `/api/sections/:sectionId/reading-profiles` update endpoint (scoped to sections the teacher advises) and a corresponding minimal UI under the teacher portal.

---

## 3. Matrix Sectioning Logic (Regular Curriculum — BEC)

### School procedure
- **Sections 1–5 (Homogeneous, Top):** Filled strictly based on highest General Average from Elementary School (descending).
- **Sections 6+ (Heterogeneous):** All remaining students after the top tier, distributed with mixed averages.

### Evidence found in EnrollPro

| Evidence | Location |
|---|---|
| `isHomogeneous: boolean` and `isSnake: boolean` flags on `Section` model | `schema.prisma`; `sections.controller.ts` |
| `pilotSections = regularSections.slice(0, params.pilotSectionCount)` — first N regular sections by `sortOrder` are treated as homogeneous "pilot" (star) sections | `sectioning-engine.service.ts` line 302 |
| `sortedRegular` pool sorted descending by `resolveGenAve()` before slicing top N into pilot sections | `sectioning-engine.service.ts` lines 437-460 |
| `heteroSections = regularSections.slice(params.pilotSectionCount)` — remaining sections receive heterogeneous snake draft | `sectioning-engine.service.ts` line 303 |
| `distributeViaSnakeDraft()` / `distributeEquitably()` applied to the remaining pool | `sectioning-engine.service.ts` lines 530-545 |
| `params.pilotSectionCount` is configurable (default matches the school's "5 top sections" policy) | `batchSectioningSchema` in `shared/src/schemas/section.schema.ts` |
| BatchSectioningWizard UI labels sections clearly as "Homogeneous Sections" vs. "Heterogeneous Sections" | `client/src/features/enrollment/components/BatchSectioningWizard.tsx` lines 882-905 |
| PRD and architecture docs explicitly state: "BEC Homogeneous Placement: Sections 1-5" / "BEC Heterogeneous: Section 6 and beyond" | `docs/core/PRD.md`; `batch_sectioning_algorithm_scp_bec.txt` |

### Verdict: ✅ ALIGNED

EnrollPro's sectioning engine precisely mirrors the school's hybrid logic:

1. **Priority 1 — SCP Placement (hard caps):** Qualifiers are assigned to their respective SCP sections before any BEC logic runs.
2. **Priority 2 — BEC Homogeneous (top sections):** The `pilotSectionCount` parameter (set to 5 by default) controls how many star sections exist. Learners are sorted descending by General Average and sliced into these sections top-to-bottom.
3. **Priority 3 — BEC Heterogeneous (remaining sections):** The remainder of the BEC pool (including STE spillover) is distributed via a snake draft across sections 6 and beyond, with `FRUSTRATION`-level readers evenly spread.

The `pilotSectionCount` is configurable per run, so the school can adjust from 5 if policies change without code changes.

---

## 4. Special Curricular Programs (SCP) Intake

### School procedure
- Students do not automatically enter SCP programs; they must **apply and pass specific requirements**.
- **Programs:** STE, SPS (Sports), SPA (Arts).
- **Requirements:** Specific assessments, qualifying exams, and parent interviews before entry.
- System must record qualifying exam and interview results before a learner can be sectioned into an SCP.

### Evidence found in EnrollPro

| Evidence | Location |
|---|---|
| `isScpApplication: boolean` and `scpType` fields on the BEERF form; SCP path is explicitly opt-in | `shared/src/schemas/early-registration.schema.ts`; BEERF form `BasicInfoStep.tsx` |
| SCP programs supported: `SCIENCE_TECHNOLOGY_AND_ENGINEERING`, `SPECIAL_PROGRAM_IN_THE_ARTS`, `SPECIAL_PROGRAM_IN_SPORTS`, `SPECIAL_PROGRAM_IN_JOURNALISM`, `SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE`, `SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION` | `WalkInEncoder.tsx` line 134 |
| Three-gate screening funnel: Gate 1 (grade threshold), Gate 2 (assessment score), Gate 3 (interview + ranking formula) | `docs/INCOMING_STE_G7_STORYBOARD.md`; `docs/SYSTEM_PROCESS_OVERVIEW_FOR_SCHOOL_ADMINISTRATORS.txt` |
| `ScpProgramConfig` model stores per-program: `isOffered`, `isTwoPhase`, `maxSlots`, `cutoffScore`, `gradeRequirements`, `rankingFormula` (configurable per school year) | `schema.prisma`; `curriculum.controller.ts` |
| `ScpProgramStep` model stores per-step assessment schedule, kind (exam/interview), cutoff score, rubric | `schema.prisma`; `scpProgramStepConfigSchema` |
| `AssessmentKind` enum: `INTERVIEW`, `QUALIFYING_EXAMINATION`, `PRELIMINARY_EXAMINATION`, `FINAL_EXAMINATION`, `GENERAL_ADMISSION_TEST`, `TALENT_AUDITION`, `PHYSICAL_FITNESS_TEST`, `SPORTS_SKILLS_TRYOUT` etc. | `docs/core/DB_NAMING_CONVENTIONS.md` |
| SCP ranking formula for STE: Exam 65% + Interview 15% + G6 Average 20% | `server/src/features/admission/services/scp-ranking.service.ts`; seed config |
| `computeRanking()` and `getSCPRankings()` services compute weighted composite scores per applicant | `scp-ranking.service.ts` |
| `[SCP]_QUALIFIED` / `FAILED_ASSESSMENT` terminal states gate whether the learner enters the SCP section pool or is redirected to BEC | `shared/src/constants/index.ts`; sectioning engine |
| Assessment batch-encoding UI: `SCPAssessmentBlock`, `PipelineBatchScpAssessmentInterviewGrid`, inline score recording with per-step cutoff display | `client/src/features/enrollment/components/SCPAssessmentBlock.tsx` |
| STE interview rubric (Picture Analysis, 100-pt rubric with 9 criteria across 3 groups) is embedded in the UI | `SCPAssessmentBlock.tsx` `InterviewRubricCard` |
| Parent/guardian interview results are recorded through the `finalize-interview` endpoint; status moves to `PASSED` or `FAILED_ASSESSMENT` | `SYSTEM_PROCESS_OVERVIEW.txt` lines 437-450 |
| Non-qualifiers are automatically redirected to `PRE_REGISTERED_BEC` pool | `INCOMING_STE_G7_STORYBOARD.md` Scene 3 |

### Verdict: ✅ ALIGNED

EnrollPro has a complete, multi-gate SCP screening pipeline that aligns with the school's requirements:

- **Separate application pipeline:** SCP intent is declared at BEERF submission (`isScpApplication = true`, `scpType = STE/SPA/SPS`). Regular enrollees never enter this pipeline.
- **Grade prerequisite gate (Gate 1):** `ScpProgramConfig.gradeRequirements` enforces minimum General Average thresholds (e.g., 85 for STE). The form prevents SCP selection if the threshold is not met.
- **Qualifying exam recording (Gate 2):** Per-step assessment scores are recorded against each `ScpProgramStep` with kind `QUALIFYING_EXAMINATION`. Cutoff scores are configurable.
- **Interview (Gate 3):** A structured `INTERVIEW` step with a configurable rubric. The STE-specific Picture Analysis rubric (9 criteria, 100 pts) is built into the interface.
- **Algorithmic ranking:** `computeRanking()` computes the weighted composite score using the configured `rankingFormula`. Rankings are viewable via the SCP Rankings endpoint before sectioning.
- **Sectioning gate:** Only learners in `[SCP]_QUALIFIED` status enter Priority 1 (SCP hard-cap placement) during batch sectioning. Non-qualifiers are automatically channeled into the BEC pool.

**Minor gap — SPS (Sports) and SPA (Arts) document upload visibility:**
While assessment kinds like `PHYSICAL_FITNESS_TEST`, `SPORTS_SKILLS_TRYOUT`, and `TALENT_AUDITION` are supported in the schema, the checklist and document upload flow does not currently surface distinct required-document prompts for SPS (e.g., medical certificate, sports achievement evidence) and SPA (e.g., portfolio) at the BEERF submission stage for the learner-facing form. These checks exist on the registrar side as checklist items, but the learner is not prompted to upload them during online registration.

**Recommendation:** In `BasicInfoStep.tsx` (BEERF form), add conditional document upload fields when `isScpApplication = true` and `scpType = SPS/SPA`, surfacing the program-specific document requirements from `ScpProgramConfig.gradeRequirements.documentRequirements`.

---

## Summary

| # | School Procedure | EnrollPro Status | Action Required |
|---|---|---|---|
| 1 | Differentiated forms (BEEF vs. Confirmation Slip) | ✅ **Aligned** | None |
| 2a | Reading assessment tracking & NON_READER flagging | ✅ **Aligned** | None |
| 2b | Teacher-conducted reading assessment (UI access) | ⚠️ **Partial** | Add teacher-facing reading profile update endpoint + UI |
| 2c | Initial listing phase (pre-form name gathering) | ❌ **Missing** | Add lightweight `EnrollmentListing` pre-registration record |
| 3 | BEC hybrid sectioning (top 5 homogeneous + heterogeneous) | ✅ **Aligned** | None |
| 4 | SCP opt-in application pipeline with exam + interview gates | ✅ **Aligned** | None |
| 4b | SPS/SPA document upload prompts during learner BEERF | ⚠️ **Partial** | Surface program-specific doc requirements in BEERF form for SPS/SPA |

### Priority of recommended changes

1. **(High) Pre-Listing record** — Enables the school's physical intake workflow to be reflected digitally before documents are collected.
2. **(Medium) Teacher reading profile update UI** — Aligns role responsibilities so teachers can directly record assessments they perform.
3. **(Low) SPS/SPA document upload prompts in BEERF** — Reduces back-and-forth between learner and registrar by surfacing missing document requirements at intake time.
