# Prompt for UI/UX & Logic Implementation: SCP Configuration Empty States

## Role & Context
Act as a Frontend Developer / UX Engineer. We are refining the `System Configuration` module, specifically the Special Curricular Programs (SCP) setup card.

Currently, when a program like SPA or SPS is toggled off, the card simply leaves an empty white void where the configuration inputs usually sit. This looks like a UI bug rather than a deliberate disabled state. We need to implement a proper "Inactive Empty State" that fills this void with helpful context, and visually mutes the card to indicate it is disabled.

## Critical Directive
Transform the inactive SCP cards from "blank spaces" into communicative empty states. Use background muting, smooth height transitions, and clear helper text to explain the system-wide consequences of disabling a program.

## UI Component & Logic Requirements

Please implement the following layout and state transitions:

### 1. Section Header Polish
*   **Rename:** Change the section title from `Active Special Curricular Programs (SCP)` to `Special Curricular Program (SCP) Configuration`. Since this panel shows both active and inactive programs, the current title is slightly misleading.

### 2. The Inactive Card State (Visual Muting)
When a program's toggle is set to `FALSE` (Inactive):
*   **Card Background:** Apply a subtle gray or muted background to the entire inner card (e.g., `bg-gray-50` or `bg-slate-50`).
*   **Header Text:** Reduce the opacity of the program title (e.g., `SPA`) to `text-gray-400` to visually reinforce that it is turned off.

### 3. The Placeholder Empty State (Filling the Void)
Instead of leaving the space below the toggle blank, render an Empty State block:
*   **Layout:** Center the content inside a dashed or subtly bordered container that matches the height of the active "Max Learner Slots" input field.
*   **Icon:** Include a small, muted icon (e.g., an eye-slash, a locked folder, or a simple information `i`).
*   **Helper Text:** Add a short explanatory string: *"Program Inactive. Toggle on to configure learner slots and enable admission tracking."*
*   **System Impact Warning (Crucial):** Add a micro-text line below it: *"Note: Disabling this hides the program from the Admission and Sectioning modules."*

### 4. Smooth State Transitions
*   **Interaction:** Do not instantly snap between the Active input fields and the Inactive placeholder text. Wrap the content area of the card in a layout transition (using Framer Motion, CSS transitions, or your UI library's equivalent).
*   **Effect:** When toggled, the content should fade and crossfade smoothly, preventing jarring UI jumps. 

### 5. Backend Configuration Binding
*   Ensure the state of these toggles is saved to a `school_settings` or `configurations` table in the database.
*   The `SCP Admission` and `Section Assignment` frontend pages must strictly fetch these settings on mount and dynamically render their top-level tabs based *only* on programs marked as `TRUE` (Active) here.