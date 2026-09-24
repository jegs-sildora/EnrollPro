# Prompt for UI/UX & Logic Implementation: Ancillary Roles Filter & Data Surfacing

## Role & Context
Act as a Full-Stack Developer. We are upgrading the `Personnel Directory` filter popover and data table. 

Currently, the system allows filtering by general HR attributes (Personnel Type, Designation, Subject). However, since the system's Role-Based Access Control (RBAC) relies heavily on "Ancillary Roles" (e.g., Grade Level Coordinators, SCP Head Teachers), the System Administrator needs a dedicated filter to quickly audit who holds these powerful system privileges. We also need to surface these roles in the table UI so the filtered results provide immediate visual feedback.

## Critical Directive
Differentiate between a Plantilla "Designation" and an "Ancillary Role" in the UI. Add the new filter dropdown to the popover, update the API fetch logic, and inject a visual indicator of the ancillary role into the personnel table rows.

## UI Component & Logic Requirements

Please implement the following changes to the frontend and backend:

### 1. Filter Popover UI Updates
*   **Rename Existing Field:** Rename the current `DESIGNATION` label to `PLANTILLA DESIGNATION` to prevent terminology confusion.
*   **Inject New Field:** Add a new dropdown labeled `ANCILLARY ROLES` directly below Plantilla Designation and above Subject.
*   **Dropdown Options:** Populate this dropdown dynamically with the enum established in the system:
    *   `ALL ANCILLARY ROLES` (Default)
    *   `Grade 7 Coordinator`, `Grade 8 Coordinator`, `Grade 9 Coordinator`, `Grade 10 Coordinator`
    *   `STE Head Teacher`, `SPA Head Teacher`, `SPS Head Teacher`
    *   `School Registrar`, `MRF Coordinator`

### 2. Table Data Surfacing (Visual Feedback)
When an admin applies the Ancillary Role filter, the resulting table rows must actually display that role. 
*   **Placement:** Inject a small, distinct badge or sub-text directly below the `EMPLOYEE ID` in the `PERSONNEL NAME` column.
*   **Styling:** Use a subtle primary-colored badge (e.g., small text, light background pill). 
*   **Example Output:** 
    `AGUILAR, CARLO MIGUEL R.`
    `EMPLOYEE ID: 1000018`
    `[Badge: Grade 7 Coordinator]`

### 3. Backend API Filter Logic
*   **Query Parameter:** Update the frontend fetch logic to append the selected role to the URL query string (e.g., `?ancillary_role=ste_head_teacher`).
*   **Controller Update:** Update the `GET /api/personnel` controller to parse this new query parameter. 
*   **Database Query:** If the parameter is present, append a `WHERE` clause that strictly matches the personnel's assigned ancillary role column/relation. 

### 4. Empty State Handling
If the admin filters by `SPA Head Teacher` and no one has been assigned that role yet, ensure the table renders a clear empty state component:
*   *Heading:* `No Personnel Found`
*   *Subtext:* `There are currently no active personnel assigned to the selected Ancillary Role.`