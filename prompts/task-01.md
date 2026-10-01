# Prompt for UI/UX & React Implementation: Early Registration Masterlist

## Role & Context
Act as a React Frontend Developer. We are introducing a new administrative module to track students who have completed the `/early-registration` form. 

This page serves as a holding area for early registrants before they are officially converted into enrollees during the official enrollment period. Because some of our beneficiary schools use Homogeneous Sectioning (strict academic ranking), the UI must heavily feature and sort by the learner's Final General Average.

## Critical Technical Directive
Do not design a new table component from scratch. You must completely reuse the existing `<DataTable>` layout, pagination, and search bar anatomy currently implemented in the `Learner Directory` page. Maintain the standard white card background, gray borders, and red primary accents.

## UI Component & Layout Requirements

Please implement the following architecture and UI layout:

### 1. Sidebar Navigation Integration
*   **Group:** Locate the `ENROLLMENT AND SECTIONING` group in the left sidebar.
*   **New Item:** Inject a new menu item labeled `Early Registration`. Place it immediately below `SCP Admission` and above `Learner Enrollment`. 
*   **Icon:** Use a calendar-check or clipboard-list icon to represent early sign-ups.

### 2. Page Header & Toolbar
*   **Page Title:** `EARLY REGISTRATION MASTERLIST`
*   **Tabs (Optional but recommended):** Create two pill-shaped tabs at the top: `Incoming Grade 7` (Active by default) and `Grades 8-10 (Transferees)`. Note: Continuing students are automatically pre-registered, so this list focuses heavily on new entrants.
*   **Search Bar:** Reuse the full-width search bar: `Q SEARCH LRN, FIRST NAME, LAST NAME...`.

### 3. The Data Table (Homogeneous Optimization)
Render a data table with the following specific headers to support academic ranking:

*   **`LEARNER NAME & LRN`**: Render the avatar, bold name, and LRN just like the Learner Directory.
*   **`TARGET GRADE`**: (e.g., "Grade 7").
*   **`PREVIOUS SCHOOL`**: (e.g., "Hinigaran Elementary School"). This is critical for validating Grade 7 entrants.
*   **`FINAL GEN AVE ↓` (Sortable - Crucial):** Display the student's Final General Average from their previous school year (e.g., `92.50`). This column header MUST be sortable. Default the table to sort by this column in *descending* order so the highest-ranking students naturally float to the top for the Pilot/Star section coordinators.
*   **`REGISTRATION DATE`**: (e.g., "Jan 25, 2026").
*   **`STATUS`**: A status pill. Default to a yellow/orange `PENDING VERIFICATION` badge.
*   **`ACTION`**: A ghost button labeled `Review Form` or `Verify` that will eventually open a modal to check their submitted early registration data.

### 4. Empty State
If no early registrants exist for the selected tab, reuse the existing empty state component (the green checkmark or gray folder icon) with the text: *"No early registration records found for this category."*