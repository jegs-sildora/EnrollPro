# Prompt for Backend & UI Logic: EOSY Rollover Draft State Enforecement

## Role & Context
Act as a Full-Stack Developer. We are refining the End of School Year (EOSY) Rollover script and the corresponding `Section Assignment` UI to ensure data integrity and user control.

Previously, the rollover script was intended to finalize the auto-sectioning. However, this bypasses the crucial "Review" phase. When the EOSY rollover runs, the continuing learners (Grades 8-10) must be auto-assigned into sections, but these assignments must remain in a `DRAFT` (Temporary) state. 

This forces the Grade Coordinator to log in, see the `TEMPORARY SECTIONS PENDING REVIEW` banner across the Grade 8, 9, and 10 tabs, and explicitly click `FINALIZE OFFICIAL SECTIONS` when they are satisfied with the algorithm's distribution.

## Backend Implementation (EOSY Script Update)

Please modify the `rolloverService` chaining logic:
*   **The Change:** When the script executes Phase 3 (Database Commits) after running the sorting algorithm, do NOT create official `EnrollmentRecord` entries. 
*   **The Draft Table:** Instead, the script must insert these assignments into the `DraftSectionRecord` table (or set `is_draft = true` on your unified records table, depending on your schema). 
*   **The Goal:** The data state immediately following the rollover must perfectly simulate a user manually clicking the `RE-RUN SECTIONING ALGORITHM` button on the frontend.

## Frontend UI Refinements (Section Assignment Page)

Ensure the UI correctly mounts in "Draft Mode" if the backend returns draft records for that grade level upon initial load:

### 1. The Global Draft Banner
*   If *any* draft records exist for the selected grade, immediately mount the full-width alert banner: `TEMPORARY SECTIONS PENDING REVIEW`.

### 2. Section Card Draft Aesthetics
*   **Card Styling:** Apply the pink/red background tint to the section cards to visually indicate they are in a temporary state.
*   **Header Badge:** Ensure the small yellow `DRAFT: [X]` badge appears next to the capacity counter, reflecting the number of drafted learners in that specific section.
*   **Title Change:** Update the right pane header from `AVAILABLE SECTIONS` to `TEMPORARY CLASS LISTS`.

### 3. Action Buttons
*   **Hide the Trigger:** Hide the primary `RE-RUN SECTIONING ALGORITHM` button at the top of the right pane.
*   **Reveal the Controls:** At the bottom of the right pane, render the sticky action footer containing the `FINALIZE OFFICIAL SECTIONS` (Solid Red) and `CANCEL TEMPORARY SECTIONS` (Ghost/Outline) buttons. 

### 4. Status Alignment
*   Even though they are in a draft section, the learners' individual status pills must still accurately reflect `PRE-REGISTERED` (since they haven't submitted their LESF yet).