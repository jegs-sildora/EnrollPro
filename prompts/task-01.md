# EnrollPro System: Bulk Selection & UI Affordance Fix
**Version:** 3.2 (Critical UX Patch)
**Focus:** Checkbox Visibility, Standard UI Affordance, and Action Bar Polish

## 1. Core Evaluation
The inclusion of DepEd grading logic `(Requires >= 75)` inside the status dropdown is an excellent addition for administrative clarity. However, the multi-select execution is currently violating standard UI principles. The master "Select All" toggle is completely invisible to the user in its default state, and the row selectors are still formatted as single-select radio buttons.

## 2. Frontend Execution (React / Tailwind)
**Assignee:** Jegrick

**TASK 1: Fix the Invisible Master Checkbox (Table Header)**
*   **The Issue:** In the unselected state, the header area next to `LEARNER` is completely blank. The user has no visual cue that a "Select All" function exists. In the selected state, it turns into a floating checkmark (`✓`) without a container.
*   **The Fix:** You must render a highly visible, square checkbox in that header at all times. 
*   **Tailwind Implementation:** Use a white or light-gray border against the maroon background to ensure it stands out. 
    *   *Unselected state:* `<div className="w-5 h-5 border-2 border-white/70 rounded-sm bg-transparent"></div>`
    *   *Selected state:* A white square filled with the maroon checkmark, or a solid white box with a colored checkmark.

**TASK 2: Enforce Square Affordance for Row Selectors**
*   **The Issue:** The individual row selection icons are currently circles (`○`). In all universal UI design systems, circles mean "Radio Button" (you can only select one). 
*   **The Fix:** We are doing *Batch Actions*, which means multi-select. These MUST be squares (`□`). 
*   **Tailwind Implementation:** Locate the `<input type="checkbox">` or custom checkbox component in the table rows and change `rounded-full` to `rounded-sm` or `rounded-md`.

**TASK 3: Polish the Action Bar Active State**
*   **The Issue:** When an action is selected, the dropdown receives a heavy maroon outline. In standard UI forms, a thick colored outline (especially red/maroon) implies a validation error or invalid input, which might confuse the user.
*   **The Fix:** Remove the red/maroon border from the dropdown's active state. Instead, use a standard subtle focus ring (`focus:ring-2 focus:ring-gray-300`). 
*   **Button Emphasis:** To make the action clearer, when a status is selected from the dropdown, change the `[ Apply to Selected ]` button from its muted gray state to a solid, confident color (e.g., a solid dark gray or secondary brand color) so the user explicitly knows the button is now "live" and ready to be clicked.

## 3. Backend Verification (Patrick)
*   Ensure that the backend explicitly validates the `(Requires >= 75)` rule. If the Registrar attempts to force a "Promoted" mass update, the backend must cross-reference the `gen_ave` of the selected array and reject the promotion for any student with an average below 75, returning a clear error toast to the frontend.