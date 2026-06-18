# MODULE: System Configuration - SY Header & Badge Refactoring (`/admin/system-configuration`)
**Tech Stack:** React, Tailwind CSS
**Context:** The current header uses an e-commerce style countdown timer ("Closes in 286 days") and a bloated, full-width badge. This must be replaced with a static, authoritative DepEd calendar display and a compact status pill.

## AGENT INSTRUCTIONS
Execute the following modifications strictly. Purge any frontend math calculating days remaining.

### Task 1: Purge Countdown Logic
*   **Target:** The `SchoolYearManagement` component.
*   **Action:** Locate any JavaScript/TypeScript logic calculating the difference between the current date and the EOSY date (e.g., `daysRemaining`, `differenceInDays`). Delete this logic entirely.

### Task 2: Header Typography & Layout Restructuring
*   **Target:** The main `<h2>` or `<h1>` inside the School Year Management card (currently "School Year 2026-2027 Setup & Configuration").
*   **Action 1 (String Replacement):** Change the text to strictly output the year: `School Year 2026-2027`.
*   **Action 2 (Flexbox Alignment):** Wrap the title and the new badge (from Task 3) in a flex row so they sit next to each other on the same line.
    *   *Implementation:* `<div className="flex items-center gap-3 mb-1">`
    *   *Title Styling:* `text-xl font-black text-foreground`

### Task 3: Badge Polish (The Compact Pill)
*   **Target:** The green "ACTIVE" badge.
*   **Action:** Remove the old, wide, light-green block. Create a highly polished, single-line pill.
    *   *Implementation:* `<span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap text-green-700 bg-green-50 border border-green-200 rounded-full">Current SY</span>`

### Task 4: Official Calendar Subtext
*   **Target:** Directly below the new Title/Badge flex container.
*   **Action:** Inject a subtle, read-only subtext row displaying the actual academic calendar dates.
    *   *Implementation:* `<p className="text-sm font-semibold text-muted-foreground">Official Academic Calendar: June 8, 2026 – April 8, 2027</p>` (Note: Bind these dates dynamically to the backend data for the current active school year).