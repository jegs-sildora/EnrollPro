# Answers to SMART Remedial Contract Questions

Here are the answers to the questions raised by the SMART team in `ENROLLPRO-REMEDIAL-CONTRACT-QUESTIONS-2026-08-31.md`, based on EnrollPro's current architecture and lifecycle rules.

## 1. Endpoint + direction
**Answer:** EnrollPro should **PULL** from SMART (acting as the orchestrator). However, since EnrollPro does not track SMART's internal remedial class groupings (e.g. section "Rizal"), pulling by a SMART `sectionId` is not feasible. 
The preferred shape is a batch pull by LRNs:
`POST /api/integration/smart/remedial/sync`
With a payload like: `{"schoolYear": "2025-2026", "lrns": ["123456789012"]}`

## 2. Payload
**Answer:** Yes, mirror the `sync-grades` posture perfectly. Per learner: remedial subject(s), final rating, pass/fail result, and publication time. EnrollPro will reject partial, missing, or unpublished grades rather than fabricating fallback values. Your proposed JSON structure looks excellent, minus the `sectionName` requirement at the root level since we will shift to a batch-LRN pull.

## 3. Timing
**Answer:** The remedial window runs **after** rollover (while the target year is in active intake). The learners will already have target-year applications created by the atomic rollover. Therefore, the query must filter by the **source** school year (when the deficiency was incurred). EnrollPro will call this endpoint when the Registrar initiates a sync from the EnrollPro Remedial Tracker UI.

## 4. Data ownership questions
**Answer:** 
- **Roster Creation:** SMART Registrar creates the roster manually in SMART, using EnrollPro's `/remedial/pending` feed as their reference list.
- **Encoding:** SMART teachers or the SMART registrar encodes the actual ratings in SMART.
- **Deadline:** Yes, all remedial outcomes must be resolved before the target year's Beginning of School Year (BOSY) enrollment is finalized.

## 5. What happens on your side when we report "passed" / "failed"?
**Answer:** 
- **If PASSED:**
  - **G7-9:** The `isRemedialRequired` flag is cleared on their target-year application (which is in `PENDING_CONFIRMATION` or already `OFFICIALLY_ENROLLED`).
  - **G10:** The `REMEDIAL_HOLD` application is resolved, the learner is marked as a `JHS_COMPLETER`, and they are dropped from active intake.
- **If FAILED:**
  - **G7-9:** The learner is demoted back to the source grade level as a Retained learner.
  - **G10:** The learner transitions from `REMEDIAL_HOLD` to `PENDING_CONFIRMATION` for Grade 10 as a Retained learner.

## 6. Timeline
**Answer:** Given that SMART requires a new data model, encoding UI, and endpoint, and EnrollPro currently has an empty placeholder for the SF10 remedial section, this should be scoped as a **next-year feature** (or a post-BOSY patch). We will not block the current EOSY lifecycle release on this.
