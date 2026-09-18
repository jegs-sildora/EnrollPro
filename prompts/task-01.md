# Prompt for UI/UX Implementation: SCP Maximum Learner Capacity Settings

## Role & Context
Act as a Frontend Developer. We are updating the `System Configuration` module in EnrollPro. 

Specifically, we are targeting the `Active Special Curricular Programs (SCP)` card located under the `SCHOOL PROFILE` tab. Currently, this card only allows the admin to toggle programs (STE, SPA, SPS) ON or OFF. 

In DepEd public schools, these specialized programs have strict enrollment caps. We need to add a "Maximum Learner Slots" numeric input that conditionally appears when a program is activated, ensuring the system knows exactly when to cut off enrollment for that specific SCP.

## Critical Directive
Strictly utilize the existing design system components, form layouts, and spacing tokens. Do not write custom CSS or introduce new wrapper styles.

## UI Component Requirements

Please refactor the `Active Special Curricular Programs (SCP)` card using the following specifications:

### 1. Refactor the SCP Item Layout
Currently, the programs (STE, SPA, SPS) are likely mapped in a simple flex or grid row. Refactor each program's UI into a distinct vertical group or sub-container.
*   **Top Row of Group:** Keep the existing Program Label (e.g., `STE`) and the existing Toggle component aligned to the right.
*   **Bottom Row of Group (Conditional):** Introduce an existing Numeric Input component directly below the toggle.
*   **Labeling:** Label this input `Max Learner Slots`. Include a standard system helper text below it (e.g., `Set the enrollment cap for this program`).

### 2. Progressive Disclosure (Conditional Rendering)
*   **If Toggle is OFF:** The `Max Learner Slots` input field must be completely hidden or removed from the DOM.
*   **If Toggle is ON:** Smoothly reveal the `Max Learner Slots` numeric input field. 

### 3. Validation & Constraints
*   **Input Type:** Ensure the input is restricted to numbers only (`type="number"`).
*   **Minimum Value:** Set a minimum threshold (`min="1"`). An active program cannot have 0 slots.
*   **Required State:** If a toggle is ON, the corresponding numeric input becomes a required field. The system configuration form should not submit if a program is active but the slot capacity is left blank.
*   **State Reset:** If the user toggles a program from ON back to OFF, the local state for that program's `max_slots` should automatically clear/reset to null.

### 4. Layout & Spacing Polish
*   Use the design system's standard grid component (e.g., a 3-column grid) to distribute the STE, SPA, and SPS blocks evenly across the card.
*   Ensure standard system padding is applied between the toggle and the conditional input field so the sub-container does not feel cramped when expanded.