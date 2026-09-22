# Prompt for UI/UX & Logic Implementation: Ancillary Roles Dropdown & RBAC Mapping

## Role & Context
Act as a Full-Stack Developer. We are updating the `Personnel Management` module (User Creation/Edit profile form) and tying it to the platform's Role-Based Access Control (RBAC).

In DepEd public schools, a teacher's system permissions are driven by their "Ancillary Role." We need to update the Ancillary Roles dropdown to include specific, localized Grade Level Coordinators and SCP Head Teachers. These selections will dictate whether the user is locked into specific Grade Levels in the Enrollment module, or specific programs in the SCP Admission module.

## Critical Directive
Utilize the existing Select/Dropdown component in the design system. Group the options logically so the System Admin can easily scan and assign the correct administrative access. Ensure the backend maps these exact enum strings to the scoped authorization middleware.

## UI Component & Data Mapping Requirements

Please implement the following updates to the Personnel form and authorization logic:

### 1. The Ancillary Role Dropdown (UI Refactor)
Update the `Ancillary Role` dropdown field to include the following grouped options. Use a grouped select component (e.g., `<optgroup>` in native HTML, or group headers in your UI library):

*   **Group 1: Enrollment & Sectioning Chairs**
    *   `Grade 7 Coordinator`
    *   `Grade 8 Coordinator`
    *   `Grade 9 Coordinator`
    *   `Grade 10 Coordinator`
*   **Group 2: Special Curricular Program (SCP) Heads**
    *   `STE Head Teacher`
    *   `SPA Head Teacher`
    *   `SPS Head Teacher`
*   *(Optional)* **Group 3: System-Wide Roles**
    *   `School Registrar` (Full enrollment access)
    *   `System Administrator` (Unrestricted access)

### 2. Frontend State & Form Locking (Enrollment Module)
When a user logs in, read their `ancillary_role` from the JWT/Session and enforce these UI rules in the `Learner Enrollment` and `Section Assignment` pages:

*   **If role is `Grade [X] Coordinator`:** 
    *   Auto-fill the `Incoming Grade Level` dropdown on the enrollment form to Grade [X].
    *   Apply a `disabled` or `read-only` state to the dropdown.
    *   Append `?grade=[X]` to all table fetch requests to isolate their view to their specific grade level.
*   **If role is `School Registrar`:** Leave the grade level dropdown unlocked and fetch all grades.

### 3. Frontend State & Tab Isolation (SCP Admission Module)
Enforce these UI rules on the `/scp-admission` page based on the `ancillary_role`:

*   **If role is `STE Head Teacher`:** Render ONLY the `STE APPLICANTS` tab. Remove SPA and SPS from the DOM.
*   **If role is `SPA Head Teacher`:** Render ONLY the `SPA APPLICANTS` tab. Remove STE and SPS.
*   **If role is `SPS Head Teacher`:** Render ONLY the `SPS APPLICANTS` tab. Remove STE and SPA.

### 4. Backend API Enforcement (The Safeguard)
Update your authorization middleware to intercept API requests and validate the payload against the user's ancillary role:

*   **Enrollment Payload Check:** On `POST /api/enrollment`, if `user.role` includes "Coordinator", assert that `request.body.grade_level` matches the number in their title. Throw a `403 Forbidden` if there is a mismatch.
*   **Admission Payload Check:** On `PATCH /api/scp/applicant`, if `user.role` includes "Head Teacher", assert that the target applicant belongs to their specific program. Throw a `403 Forbidden` if an STE Head Teacher attempts to modify an SPA applicant.