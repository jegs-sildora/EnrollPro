# Relationships

## Purpose

Describes the most important database relationships and invariants.

## Summary

School year, learner, application, section, and record relationships define the operational backbone of EnrollPro. Most business correctness depends on keeping these relationships synchronized.

## Detailed Analysis

Important invariants:

- One `EnrollmentApplication` per `learnerId` and `schoolYearId`.
- One `EnrollmentRecord` per finalized `EnrollmentApplication`.
- Sections are unique by `name`, `gradeLevelId`, and `schoolYearId`.
- Teacher designations are unique by `teacherId` and `schoolYearId`.
- Health records are unique by `learnerId`, `schoolYearId`, and `assessmentPeriod`.
- Learners have unique LRN when present and an external UUID.
- Section adviser records preserve advisership history.

School-year relationships:

- Current operational state lives in active-year applications, records, and sections.
- Historical outcomes are preserved in `EnrollmentHistory`.
- `SchoolSetting.activeSchoolYearId` points the app to the active year.

## Dependencies

- [[Tables]]
- [[School Operations]]
- [[Enrollment Workflow]]

## Risks

- Partial transitions can leave application status, enrollment record, and learner status inconsistent.
- Cascade deletes should be used carefully around school-year test data.

## Recommendations

- Use transactions for status-changing workflows.
- Add consistency checks for active school year and enrollment record state.
- Prefer append-only history for audit-sensitive records.

## Related Notes

- [[Risk Register]]
- [[Database Architecture]]

