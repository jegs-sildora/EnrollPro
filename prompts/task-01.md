# Prompt for UI/UX & Logic Refactor: Context-Aware Application Tracker

## Role & Context
Act as a Full-Stack Developer. We are refactoring the (Monitor Portal) page. 

Currently, the portal renders a static "Enrollment Progress" stepper for every queried tracking number. This is a critical UX flaw because in DepEd systems, SCP Admission (Screening/Exams) and Official Enrollment (Sectioning/LIS Encoding) are two distinct administrative phases. 

We need the portal to dynamically adapt its UI stepper based on the *type* of application associated with the tracking number, and smoothly hand off qualified SCP applicants to the actual enrollment phase.

## Critical Directive
Utilize the existing design system cards, text elements, and vertical stepper components. The backend must now return an `application_type` parameter (e.g., `ADMISSION` vs `ENROLLMENT`) alongside the status data to dictate which frontend component to render.

## UI Component & State Logic Requirements

Please implement the following context-aware logic:

### 1. The Dynamic Header Card
*   **Update:** Keep the existing 3-column information grid (`LEARNER NAME`, `INCOMING GRADE`, `CURRICULAR PROGRAM`). 
*   **Addition:** Add a status badge next to the `CURRENT STATUS` text at the top of the card that explicitly labels the phase: e.g., a blue badge reading `[ADMISSION PHASE]` or a green badge reading `[ENROLLMENT PHASE]`.

### 2. Layout A: The "Admission Phase" Stepper
If the tracking number belongs to an SCP Admission Form (e.g., `STE...`, `SPA...`), render this 3-step timeline:

*   **Step 1: Document Verification**
    *   *Pending:* "Awaiting physical submission of SF9 and requirements."
    *   *Passed:* "Requirements verified by Registrar."
*   **Step 2: Screening & Assessment**
    *   *Pending:* "Awaiting exam and/or interview results."
    *   *Passed:* "Screening completed."
*   **Step 3: Final Admission Result (The Handoff)**
    *   *Pending:* (Muted)
    *   *Failed (Red):* "Did not meet program requirements."
    *   *Qualified (Green):* "Congratulations! You are qualified for [Program Name]."
    *   **CRITICAL UX HANDOFF:** If Step 3 is `Qualified`, render a prominent primary button directly inside the Step 3 container: `Proceed to Official Enrollment`. Clicking this button must route the user to the Online Enrollment form and auto-fill their LRN so they don't have to start from scratch.

### 3. Layout B: The "Enrollment Phase" Stepper
If the tracking number belongs to a standard Online Enrollment Form (or a Qualified SCP learner who has proceeded to enroll), render the existing 3-step timeline:

*   **Step 1: Registrar Review**
    *   "The Registrar's Office is verifying your official enrollment records."
*   **Step 2: Ready for Sectioning**
    *   "Learner is queued for automated class sectioning."
*   **Step 3: Officially Enrolled**
    *   "Section finalized. Welcome to S.Y. [School Year]."

### 4. Waitlist & Disqualified Error States
Ensure the timeline gracefully halts if an applicant does not proceed:
*   **Waitlisted (Admission):** Change Step 3 to a Yellow warning state. "Passed screening, but placed on the waitlist due to limited program slots."
*   **Disqualified (Admission):** Change Step 3 to a Red error state. "Please proceed to the registrar to explore Regular BEC enrollment options."

### 5. Backend Payload Requirement
Update the tracking API endpoint (`GET /api/track/:tracking_number`). It must return:
1. `application_type`: ENUM ('ADMISSION', 'ENROLLMENT')
2. `current_step`: Integer/String mapping to the active step.
3. `status`: ENUM ('PENDING', 'PASSED', 'FAILED', 'WAITLISTED')
The frontend will switch between `<AdmissionTimeline />` and `<EnrollmentTimeline />` components based strictly on `application_type`.