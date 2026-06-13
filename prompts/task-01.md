# EnrollPro System: Teacher Workspace Refinement Directive
**Version:** 2.0 (Polish & Validation)
**Focus:** React Component Consistency & Express.js Payload Validation

## 1. Core Architectural Goal
The Teacher's Role-Based Access Control (RBAC) sidebar is functionally correct. We must now strictly enforce UI component consistency across their workspace and lock down the data entry points to prevent accidental bad data from polluting the sectioning algorithm.

## 2. Frontend Execution (React / Tailwind)
**Assignee:** Jegrick

**TASK 1: Enforce DRY Table Architecture (`My Advisory Class`)**
*   **Issue:** The current roster table is a bespoke, un-styled list.
*   **Fix:** Unmount the custom table. Import and map the standard global `<Table/>` component (with the maroon header and F-pattern alignment) to display the enrolled learners. Ensure visual consistency across the entire platform. 
*   **Enhancement:** Make the learner rows clickable, opening a read-only sidepanel with their basic DepEd profile (address, guardian contact) so the teacher has quick access to emergency info.

**TASK 2: Input Affordance & Validation (`EOSY Finalization`)**
*   **Issue:** The `GEN AVE` inputs look disabled (gray background) and lack visible typing constraints.
*   **Fix:** Update the input styling. Use a white background with a subtle border (e.g., `bg-white border border-gray-300 rounded-md shadow-sm`). Add a clear focus state (e.g., `focus:ring-2 focus:ring-maroon-500`).
*   **Client-Side Validation:** Enforce strict number constraints on the input field. `min="60"`, `max="100"`, and `step="1"`. Do not allow alphabetical characters.

**TASK 3: The Submission UX & Lock-Out State**
*   **Confirmation:** Clicking `[ Submit to Registrar ]` must trigger a modal: *"Warning: This action is final. Are you sure you want to lock these grades and forward them to the Head Registrar?"*
*   **Optimistic Lock:** Upon successful API response, the page must immediately re-render in a "Locked" state. 
    *   Disable all `GEN AVE` inputs.
    *   Disable all `EOSY STATUS` dropdowns.
    *   Replace the Submit button with a green badge: `✓ Submitted & Locked`.

## 3. Backend Execution (Express.js / PostgreSQL)
**Assignee:** Patrick

**TASK 1: Strict Payload Validation**
*   When the Teacher submits the EOSY payload to the Express API, do not trust the client. 
*   Execute backend validation iterating over the array of students. Ensure every `gen_ave` is a valid integer between 60 and 100. Reject the entire payload with a `400 Bad Request` if any outlier is detected.

**TASK 2: State Locking & Role Escrow**
*   Upon successful validation, execute an `UPDATE` query that flags the section as `is_eosy_locked = true`.
*   Once this flag is set to true, the backend must return a `403 Forbidden` if the teacher's token attempts to run a subsequent `PUT` or `PATCH` request to those students' records. Only a token with the `REGISTRAR` or `ADMIN` role should be able to bypass or reverse this lock.