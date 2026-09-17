# Prompt for UI/UX & Logic Implementation: JHS Completers Filter Refactor

## Role & Context
Act as a Frontend Developer. We are refining the "Filter Learners" popover in the Learner Directory of EnrollPro. 

Currently, when a registrar navigates to the `COMPLETERS / ALUMNI` tab, the filter popover displays generic fields (`GRADE LEVEL`, `EOSY PROMOTION STATUS`) that do not apply to alumni. By DepEd definition, all Completers are Grade 10 students who were successfully promoted. We need to swap these irrelevant filters for alumni-specific search criteria, utilizing our existing design system components.

## The Objective
Dynamically render a different set of filter dropdowns inside the popover when the active tab is `COMPLETERS / ALUMNI`. The primary filtering mechanism must pivot from "Current Grade" to "Completion Year (Batch)".

## UI Component Requirements

When the `COMPLETERS / ALUMNI` tab is active, implement the following specific filter configuration inside the popover using existing design system select/dropdown components:

### 1. Remove Irrelevant Filters
*   **Hide `GRADE LEVEL`:** All learners in this tab are Grade 10 Completers. Do not render this dropdown.
*   **Hide `EOSY PROMOTION STATUS`:** All learners in this tab are successfully promoted/completed. Do not render this dropdown.

### 2. Implement Alumni-Specific Filters
*   **Filter 1: `COMPLETION YEAR (BATCH)` (New Primary Filter)**
    *   **Component:** Existing select/dropdown component.
    *   **Label:** `COMPLETION YEAR`
    *   **Default State:** `All Batches`
    *   **Options:** Populate with historical school years (e.g., `S.Y. 2029-2030`, `S.Y. 2028-2029`).
*   **Filter 2: `CURRICULAR PROGRAM` (Keep Existing)**
    *   **Component:** Existing select/dropdown component.
    *   **Label:** `PROGRAM`
    *   **Default State:** `All Programs`
*   **Filter 3: `GRADE 10 SECTION` (Keep but Rename)**
    *   **Component:** Existing select/dropdown component.
    *   **Label:** `G10 SECTION` (Clarify that this searches the section they belonged to when they completed).
    *   **Default State:** `All Sections`

### 3. Cascading Logic (Data Scoping)
*   The `G10 SECTION` dropdown must be dependent on the `COMPLETION YEAR` dropdown. 
*   If a registrar selects `S.Y. 2029-2030`, the Section dropdown should only populate with the Grade 10 sections that existed during that specific school year.

### 4. Layout & Actions
*   Maintain the existing vertical stacking layout for the dropdowns.
*   Maintain the existing sticky footer with the `Clear All` ghost button and the `Apply Filters` primary button.
*   Clicking `Clear All` should reset these specific alumni dropdowns back to their "All" states.