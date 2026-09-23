# Prompt for Backend Logic Refactor: Decoupling Admission vs. Enrollment Validation

## Role & Context
Act as a Backend Developer. We need to fix a critical data validation bug in the `POST /api/enrollment` controller. 

Currently, the system throws a `409 Conflict` (Duplicate Detected) if a user submitting the Enrollment Form already has a record in the `SCP Admission` roster. This is structurally incorrect. Admission is a prerequisite screening process; passing it means the learner is *required* to submit an enrollment form. The system is currently blocking our most qualified students from officially enrolling.

## Critical Directive
Separate the validation queries for the `admissions` table and the `enrollments` table. An existing admission record must *facilitate* enrollment (by locking their program choice), not *block* it. Duplicate detection must strictly scope to the `enrollments` table for the active school year.

## Backend Validation Logic Requirements

Please rewrite the validation checks in the enrollment submission controller to follow this exact sequence:

### 1. The Duplicate Enrollment Check (The Block)
*   **Query:** Check the `enrollments` table where `lrn = request.body.lrn` AND `school_year_id = current_active_year`.
*   **Action:** If a record is found here, it means the parent already enrolled the child for this specific school year. 
*   **Response:** Throw the `409 Conflict` error, which will trigger the "Duplicate Enrollment Detected" modal on the frontend.

### 2. The Admission Cross-Reference (The Facilitator)
*   **Query:** If the enrollment check passes (no duplicate enrollment found), check the `scp_admissions` table for the same LRN.
*   **Action:** 
    *   If an admission record is found with `FINAL RESULT: QUALIFIED`, accept the enrollment submission but strictly override the payload's `curricular_program` to match their qualified SCP program (to prevent frontend tampering).
    *   If no admission record is found, accept the enrollment submission but strictly default the `curricular_program` to `Regular BEC`.
*   **Response:** Proceed with the database `INSERT` into the `enrollments` table and return a `201 Created` success response.

### 3. Data Integrity & Migration
Ensure there is a clear foreign key or conceptual relationship between an `enrollment` record and its preceding `admission` record, but do not combine them into a single state machine. A learner can exist in the admission table and never enroll (e.g., they moved to another city), or they can exist in the enrollment table without ever going through admission (e.g., a Regular BEC student).