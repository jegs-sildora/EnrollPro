# Prompt for UI/UX & React Implementation: Dedicated Program Roster Page

## Role & Context
Act as a React Frontend Developer. We are implementing the routing and UI for the "View Roster" button found on the Dashboard's `Learners by Curricular Program` cards.

Instead of overloading the existing section masterlist component, create a brand new, dedicated page component named `ViewProgramRoster.tsx`. This page will display a comprehensive list of all enrolled learners for a specific curriculum (e.g., all BEC learners or all STE learners), while mirroring the familiar split-table aesthetics of the section masterlist.

## Critical Technical Directive
Create a standalone `ViewProgramRoster.tsx` page. The UI must adapt the visual language of the section masterlist (split Male/Female tables) but remove section-specific constraints (like class capacities, advisers, and SF1 forms). Since this is an aggregated view across multiple grade levels, the data tables must clearly indicate which grade and section each learner currently belongs to.

## UI Component & Logic Requirements

Please implement the following architecture and UI layout:

### 1. File Creation & Routing
*   **New Component:** Create `src/pages/ViewProgramRoster.tsx` (or your equivalent path).
*   **Routing:** Bind the "View Roster" button on the Dashboard cards to redirect to this new page, passing the program identifier in the URL (e.g., `/dashboard/program-roster/bec` or `/dashboard/program-roster/ste`).

### 2. Page Header & Metadata
At the top of the page, render a header block containing:
*   **Breadcrumb:** `< Back to Dashboard` (positioned at the top left).
*   **Page Title:** `PROGRAM ROSTER — [FULL CURRICULUM NAME]` (e.g., `PROGRAM ROSTER — BASIC EDUCATION CURRICULUM`).
*   **Metric Badges:** Align to the right side of the header:
    *   `Total Enrolled: [X]`
    *   `M: [X]` (Male count badge)
    *   `F: [X]` (Female count badge)
*   **Action Button:** Place an `Export Roster (CSV/PDF)` button near the metrics. Do *not* label this as "SF1", as School Form 1 is strictly for class sections, not entire curricular programs.

### 3. The Split Data Tables
Below the header, render the signature split-table layout:
*   **Left Pane:** `MALE LEARNERS`
*   **Right Pane:** `FEMALE LEARNERS`
*   **Columns Required:** 
    *   `#` (Row index)
    *   `LEARNER` (Name and LRN)
    *   `GRADE & SECTION` (Crucial: Display their current placement, e.g., "Grade 7 - Rizal" or "Unassigned")
    *   `ACTION` (A button/icon to view the full Learner Profile)

### 4. Data Fetching
*   **Query Logic:** The component must fetch learners where `enrollment_status = 'OFFICIAL'` and `curricular_program = [URL Parameter]`.
*   **Empty State:** If a program has no enrolled learners yet, render a standard empty state illustration inside the table area stating *"No enrolled learners found for this curricular program."*