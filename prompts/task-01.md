# System Prompt: Implement RBAC-Driven Dynamic Sidebar Navigation

**Role:** Senior React/Next.js UI Engineer & DepEd JHS Domain Expert

## Context
We are refining the global navigation architecture for the "EnrollPro" platform. Currently, the sidebar exposes all system modules to every logged-in user, regardless of their position. As highlighted in the system mockups, a System Administrator sees highly sensitive modules like "System Administration" (Activity Logs, System Configuration) and "Personnel Directory"[cite: 28, 29]. Exposing these to regular Subject Teachers or Class Advisers creates severe UI clutter and violates data privacy principles. 

Furthermore, the sidebar needs to be context-aware of the academic calendar, swapping between "Enrollment and Sectioning"[cite: 28, 29] and "End of School Year Processing" (EOSY) depending on the active school year phase.

## Task
Refactor the `Sidebar.tsx` component to act as an intelligent, RBAC-driven navigation hub. You must create a centralized navigation configuration matrix that dynamically filters and renders menu items based on the active user's roles and the current school year phase.

## Design & Logic Constraints (CRITICAL)

### 1. The Navigation Configuration Matrix
Define a robust TypeScript object/array (e.g., `NAVIGATION_ITEMS`) that maps every sidebar group and link to its allowed DepEd roles. 

**Required Role Mappings:**
*   **System Administration Group:**
    *   *Activity Logs & System Configuration:* Strictly limit to `System Admin`[cite: 28, 29]. 
*   **Enrollment & Sectioning Group (Active during start of year):**
    *   *Early Registration & Learner Enrollment:* Limit to `System Admin`, `Head Registrar`, and `Grade Level Coordinator (GLC)`[cite: 28].
    *   *SCP Admission:* Limit to `System Admin`, `Head Registrar`, and `SCP Coordinators (STE, SPA, SPS)`[cite: 28].
    *   *Section Assignment:* Limit to `System Admin`, `Head Registrar`, and `GLC`[cite: 28].
*   **End of School Year (EOSY) Group (Active during year-end):**
    *   *EOSY Updating:* Limit to `System Admin`, `Head Registrar`, and `GLC`.
*   **Teaching & Advisory Group:**
    *   *Advisory Class:* Strictly limit to users with the `Class Adviser` role.
*   **School Records Group:**
    *   *Learner Directory & Class Sections:* Accessible by `System Admin`, `School Head`, `Head Registrar`, `GLC`, `SCP Coordinator`[cite: 28].
    *   *Personnel Directory:* Limit to `System Admin`, `School Head`, and `Head Registrar`[cite: 28].
*   **Integrated Systems Group:**
    *   *SMART (Grading):* Accessible by `Class Adviser` and `Subject Teacher`[cite: 28].

### 2. Handling Multiple Overlapping Roles
In DepEd, a single faculty member often holds multiple designations (e.g., a Subject Teacher who is also a Grade 7 GLC and a Class Adviser). 
*   The sidebar logic must **aggregate** permissions. If a user's role array includes `['TEACHER', 'GLC', 'CLASS_ADVISER']`, the filtering function must merge the allowed routes for all three roles, displaying a unified sidebar without duplicate links.

### 3. Academic Phase Toggling
*   The sidebar must read the `schoolYearPhase` from the global settings state.
*   If the phase is `ENROLLMENT` or `CLASSES_ONGOING`, render the "Enrollment and Sectioning" group[cite: 28].
*   If the phase is `EOSY_CLOSING`, hide the enrollment links and dynamically render the "End of School Year Processing" group.

## Output Requirement
Provide the complete TypeScript implementation for the RBAC-driven sidebar. Focus on the data structure of the `NAVIGATION_ITEMS` matrix and the exact filtering function used to derive the authorized menu items before mapping them to the UI. You do not need to generate the raw HTML/CSS for the sidebar itself, just the logic and configuration strategy ensuring strict domain compliance.