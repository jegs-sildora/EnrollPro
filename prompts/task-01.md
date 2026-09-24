# Prompt for UI/UX & Logic Implementation: Cross-Module Enrollment Visibility

## Role & Context
Act as a Full-Stack Developer. We are enhancing the `SCP Admission` table to solve a critical operational blind spot.

Currently, the table shows the admission `FINAL RESULT` (e.g., QUALIFIED, WAITLISTED), but Program Coordinators cannot see if these qualified learners have actually proceeded to officially enroll. We need to fetch the learner's corresponding enrollment record and display a lightweight "Enrollment Status" indicator directly on the admission roster, helping coordinators identify which slots are actually secured and which are pending/abandoned.

## Critical Directive
Do NOT add a new table column; this will overcrowd the layout. Inject a micro-badge (a small status pill) directly into the `APPLICANT NAME & LRN` column, positioned immediately below the LRN. This keeps the data dense, readable, and perfectly contextualized.

## UI Component & Logic Requirements

Please implement the following frontend UI and backend hydration logic:

### 1. The Micro-Badge UI Component
*   **Placement:** Inside the first data column, directly beneath the `LRN: XXXXXXXXXXXX` string. 
*   **Styling:** Use a very small, rounded badge (e.g., `text-xs`, `px-2`, `py-0.5`). It must be visually distinct from the larger, heavier `FINAL RESULT` badges on the far right.

### 2. State Mapping & Typography
The badge must dynamically render based on the learner's linked `EnrollmentApplication` status for the active school year:

*   **State A: No Enrollment Record (The Ghost)**
    *   *Logic:* The learner is `QUALIFIED` in admissions, but no `enrollments` row exists for them yet.
    *   *UI:* Gray/Muted background, dark gray text. 
    *   *Label:* `Pending LESF Submission` or `Not Yet Enrolled`
*   **State B: Enrollment Under Review (The Active Pipeline)**
    *   *Logic:* The learner submitted the enrollment form, but the Grade Coordinator/Registrar hasn't verified it yet.
    *   *UI:* Warning/Yellow background, dark amber text.
    *   *Label:* `Enrollment For Verification`
*   **State C: Officially Enrolled (The Secured Slot)**
    *   *Logic:* The learner's enrollment is fully verified and they are sectioned.
    *   *UI:* Success/Green background, dark green text.
    *   *Label:* `Officially Enrolled`

### 3. Backend Data Hydration (The Query)
To make this work without spamming the database with N+1 queries, update the `GET /api/admissions/roster` controller:
*   Perform a `LEFT JOIN` (or eager load/`include` depending on your ORM) on the `enrollments` table using the `learner_id` or `lrn` for the `current_school_year_id`.
*   Append this enrollment state as a nested object or flat field in the admission roster JSON payload (e.g., `enrollment_status: "VERIFIED" | "PENDING" | null`).

### 4. UX Polish: Actionable Tooltips
Add a native HTML `title` or a library tooltip to the micro-badge.
*   If `Pending LESF Submission`, the tooltip should say: *"This applicant has not yet submitted their official enrollment form. Follow up to secure their slot."*
*   If `Officially Enrolled`, the tooltip should say: *"This learner is officially registered for the upcoming school year."*