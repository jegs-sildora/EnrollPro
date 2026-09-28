# Prompt for UI/UX & Logic Refactor: 1-Click Auto-Sectioning & Visual Feedback

## Role & Context
Act as a Frontend Developer / UX Engineer. We are eliminating "modal fatigue" in the `Section Assignment` workspace. 

Currently, clicking the primary `AUTO ASSIGN SECTIONS` button forces the user to read an instructional modal before they can actually execute the algorithm. We are decoupling this. The primary button must instantly execute the algorithm, while the instructions will be moved to a secondary, optional help trigger. Because the action is now instant, we must introduce fluid, repetitive visual animations to show the user that the system is actively processing and sorting hundreds of learners.

## Critical Directive
Remove the modal trigger from the primary `AUTO ASSIGN SECTIONS` button. Bind the main button directly to the sorting API. Implement a satisfying, animated state transition that visually communicates the "draining" of the unassigned pool and the "filling" of the section capacities.

## UI Component & Animation Requirements

Please implement the following layout changes and animation sequences:

### 1. Button Reorganization (The Trigger Area)
Update the top-right header area of the Available Sections pane:
*   **Primary Action:** Keep `AUTO ASSIGN SECTIONS` as the solid primary button. It now directly fires the API request.
*   **Secondary Action:** Inject a small, subtle text link or ghost button directly below it: `ⓘ How does the system place learners?`
*   **Modal Routing:** Bind the existing `AUTO ASSIGN TEMPORARY SECTIONS` instructional modal exclusively to this new secondary link. Remove the "Generate" button from inside the modal, leaving only a "Close" or "Got it" button.

### 2. The Execution State (Loading Phase)
When `AUTO ASSIGN SECTIONS` is clicked, immediately lock the workspace to prevent race conditions:
*   **Button State:** Transform the button to disabled, change the text to `Running Sorting Algorithm...`, and render a spinning loader.
*   **Left Pane (The Pool):** Apply a disabled overlay or reduce the opacity of the `LEARNERS READY FOR SECTIONING` list. 
*   **Right Pane (The Targets):** Apply a continuous CSS "shimmer" or pulse effect to the empty Section Cards to indicate they are awaiting data.

### 3. The Resolution Animation (The "Sorting" Experience)
When the backend returns the successfully sorted draft arrays, do not just instantly snap the UI to the new state. Orchestrate a ~600ms staggered animation sequence (using CSS transitions, Framer Motion, or your UI library's equivalent):
*   **The Drain:** Animate the successfully sectioned learners in the left pane by fading them out and sliding them slightly to the right, simulating them leaving the pool.
*   **The Fill (Ticker Animation):** On the Section Cards, animate the `CAPACITY FILL` counters. Instead of jumping from `0` to `40`, use a fast number ticker effect that counts up (`0, 12, 28, 40`) over 400ms. Do the same for the `M: 0` and `F: 0` gender badges.
*   **The Badge Reveal:** Pop in the yellow `DRAFT` status badges on the section cards with a slight `scale-up` or `spring` bounce effect to draw the user's eye to the new state.

### 4. Post-Animation Cleanup
*   Once the animations complete, restore the primary button to its default state (but perhaps change the label to `RE-RUN ALGORITHM` or `CLEAR DRAFT` depending on your reset logic).
*   Trigger a success Toast/Snackbar: *"Draft sections generated successfully. Please review the temporary rosters."*