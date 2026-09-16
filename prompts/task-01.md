# Prompt for UI/UX & Logic Implementation: Class Adviser RBAC and Enrollment Scoping

## Role & Context
Act as a Full-Stack Developer. We are implementing Role-Based Access Control (RBAC) and Data Scoping for the `CLASS_ADVISER` system role in EnrollPro (a DepEd Junior High School system). 

During the official enrollment period, teachers designated as Class Advisers act as front-line encoders. However, to prevent data leaks and reduce cognitive load, their UI and data access must be strictly limited compared to a System Administrator or Principal.

## The Objective
Restrict the Class Adviser's sidebar navigation strictly to the Enrollment modules. Furthermore, enforce strict data scoping so that an adviser can only view, search, and enroll learners corresponding to their officially assigned Grade Level (e.g., a Grade 7 adviser cannot see or encode Grade 8 learners).

## UI & Frontend Implementation Requirements

Please implement the following layout and state changes when the active user has the `CLASS_ADVISER` role:

### 1. Sidebar Navigation Restriction
Hide all administrative and school record modules. The sidebar should only render the following standard components:
*   **Section Header:** `ENROLLMENT` (or `ENROLLMENT AND SECTIONING`)
*   **Menu Item 1:** `Dashboard`
*   **Menu Item 2:** `Learner Enrollment`
*   *(Crucial: Hide `Section Assignment`, `Learner Directory`, `Personnel Directory`, `System Administration`, etc.)*

### 2. Time-Bound Access (Enrollment Period)
The system must check the `Enrollment Period` dates set in the System Configuration.
*   **Active Period:** Render the modules normally.
*   **Inactive/Closed Period:** If the adviser logs in outside the official BOSY (Beginning of School Year) enrollment period, change the `Learner Enrollment` page to an Empty State / Locked component with a message: *"Enrollment is currently closed. Access will resume during the next official encoding period."* Hide all action buttons and data tables.

### 3. "Learner Enrollment" UI Data Scoping
When the adviser opens the `Learner Enrollment` page, the UI must dynamically adapt to their assigned grade level (derived from their user profile/personnel record).
*   **Pre-Applied Filters:** The "Grade Level" filter or tab must be pre-set to their assigned grade (e.g., `Grade 7`).
*   **Locked State:** Disable or completely hide the other Grade Level options in the dropdown/tabs. The adviser should not even have the option to click "Grade 8", "Grade 9", or "Grade 10".
*   **Walk-In Modal Constraint:** If they click the `+ Encode Walk-In` button, the "Incoming Grade Level" field inside the modal must be locked/disabled and pre-filled with their assigned grade level to prevent accidental encoding into the wrong cohort.

## Backend & API Security (Critical)
Do not rely solely on the frontend to hide data. 
*   **API Interception:** Update the learner fetch endpoints. If the requesting user is a `CLASS_ADVISER`, the backend must automatically inject a `WHERE grade_level = [Adviser's Assigned Grade]` clause into the database query.
*   **Validation:** If an adviser attempts a POST request to enroll a student into Grade 8, but they are a Grade 7 adviser, the backend must reject the request with a `403 Forbidden` error.