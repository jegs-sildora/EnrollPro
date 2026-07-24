# Master Dashboard

Last reviewed: 2026-07-24

The Master Dashboard is the school-year operational summary. `GET /api/dashboard/stats` supplies school-year-scoped values.

## Summary

The top ribbon shows:

- total official enrollment
- active faculty in active service
- sections containing enrolled learners
- learners needing system validation

Counts must avoid duplicate learners when one learner has more than one missing requirement.

## Enrollment Operations

The enrollment phases show:

- pending learner enrollment
- learners ready for class sectioning
- lacking documentary requirements
- curriculum distribution
- incoming learner pipeline by grade
- section capacity and overcrowding
- SF1 data checks

Operational cards remain visible at zero and use clear completion wording. Available actions include staff-assisted walk-in encoding, SF1 or SF7 spreadsheet workflows, and automatic temporary section placement.

EnrollPro does not handle Early Registration. Incoming Grade 7 processing begins in Learner Enrollment.

## Classes Ongoing

The dashboard shows the BOSY baseline, authorized late admissions, dropped learners, transferred learners, and the resulting active count. It keeps documentary follow-up, unsectioned learners, and capacity warnings visible.

SMART owns attendance. EnrollPro provides learner, section, and school-year context and a gateway to SMART; it does not calculate attendance.

## EOSY Closing

The dashboard shows sections awaiting finalization, incomplete SMART outcomes, conditional promotion and retention cases, grade-level completion, and SF5 or SF6 readiness.

Enrollment actions are locked. The primary action opens EOSY monitoring.

## Archived Years

Archived years show historical outcomes without create, update, intake, sectioning, or rollover controls.

## Permissions And Language

Actions follow the backend role requirements. Labels use plain DepEd school-office terms. Warning colors are reserved for real blockers, missing records, or capacity problems.

