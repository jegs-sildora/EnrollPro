# Learner Enrollment And Sectioning

Last reviewed: 2026-07-24

## Scope

Learner Enrollment is the single intake workspace for:

- continuing Grades 8 to 10 learners
- incoming Grade 7 learners
- transferees
- returning or Balik-Aral learners
- authorized walk-in learners

EnrollPro has no Early Registration workflow.

## Incoming Learners

Public or staff-assisted applications collect learner identity, LRN, demographics, address, parent or guardian contact, previous-school information, and required documents. Public submission is available only during permitted enrollment phases and dates.

Staff review documentary requirements. A complete learner moves to `READY_FOR_SECTIONING`. A learner accepted with missing records is marked temporarily enrolled and enters documentary follow-up without delaying class placement.

## Continuing Learners

Atomic rollover creates pending confirmation applications for eligible learners:

- promoted Grades 7 to 9 move to the next grade
- retained Grades 7 to 9 repeat the same grade
- conditionally promoted Grades 7 to 9 advance with an academic-deficiency flag
- retained Grade 10 repeats Grade 10

Promoted Grade 10 learners become JHS completers. Grade 10 conditional cases enter remedial hold. Dropped and transferred-out learners do not receive automatic carryover.

Staff enroll a returning learner after check-in. Confirmation adds the learner to the official school total and the unassigned sectioning pool, but the class masterlist is created only after section assignment.

## Class Sectioning

The Class Sectioning and SF1 workspace separates intake from placement.

Automatic placement creates a temporary draft using grade, program, final general average, sex balance, and capacity. Special Curricular Program eligibility is respected during automatic placement. Staff can review, move, or swap learners before finalizing.

Manual changes are recorded as `MANUAL_OVERRIDE`. Capacity exceptions require an explicit authorized override. Final commit creates `EnrollmentRecord` rows and marks applications officially enrolled. Conflicted records are skipped with a clear reason.

## SF1

An individual section masterlist provides:

- official SF1 export
- blank SF1 template download
- SF1 upload preview
- valid-row commit

The current section is authoritative for school year, grade, program, and section. Import requires a valid 12-digit LRN, readable learner name, birthdate, and sex. Duplicate LRNs and learners already active in another section are blocked.

## Classes Ongoing

Public online enrollment is closed. Authorized staff may process a late walk-in learner and place the learner in a section. EOSY Closing blocks new intake mutations.

## Realtime Handoff

Enrollment and sectioning mutations invalidate dashboard, learner, section, and sectioning data after commit. No page refresh should be required.

