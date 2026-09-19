# Prompt for UI/UX Implementation: SCP Admission Period Configuration

## Role & Context
Act as a Frontend Developer. We are updating the `System Configuration` module under the `School Year Management` tab.

Currently, the system only has a date controller for the `OFFICIAL ENROLLMENT PERIOD`. Because Special Curricular Programs (STE, SPA, SPS) conduct their screening and admissions months prior to regular enrollment, we need a dedicated date controller for the `SCP ADMISSION PERIOD`. This new controller will dictate when the public-facing SCP Online Admission Form is accessible.

## Critical Directive
Strictly utilize the existing design system components (cards, date pickers, status badges). Do not write custom CSS or introduce new wrapper styles.

## UI Component Requirements

Please implement the following layout additions:

### 1. New Configuration Card: SCP Admission Period
Duplicate the UI layout of the existing `OFFICIAL ENROLLMENT PERIOD` card and place it directly above or below it.

*   **Card Title:** `SCP ADMISSION PERIOD`
*   **Tooltip/Helper Icon:** Include a small info icon `(?)` next to the title. On hover, display: *Controls the automated opening and closing of the public-facing SCP Online Admission Form.*
*   **Status Badge:** Reuse the existing pill badge component in the top-right corner of the card. It should dynamically compute its state based on the current system date versus the selected date range (e.g., render a green `ADMISSION OPEN` badge or a muted `ADMISSION CLOSED` badge).

### 2. Date Picker Grid
Inside the new card, replicate the 2-column grid layout used for the official enrollment dates.
*   **Left Column (`OPENS ON`):** Render the existing Date Picker component.
*   **Right Column (`CLOSES ON`):** Render the existing Date Picker component. 
*   **Validation:** Ensure standard date validation is applied (the `CLOSES ON` date cannot be prior to the `OPENS ON` date).

### 3. Backend Integration Hook
*   Ensure that the `OPENS ON` and `CLOSES ON` values for this new card are saved to a separate database column (e.g., `scp_admission_start_date` and `scp_admission_end_date`) in the school year configuration table, completely independent of the `official_enrollment` dates.
*   The public-facing SCP Admission Form page must query these new specific dates to determine whether to render the application form or a "Screening Period Closed" empty state.