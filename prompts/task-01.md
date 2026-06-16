# Admin Dashboard: UI Standardization & "Quick Links" Injection
**Version:** 33.0 (CSS Polish & DepEd Form Generation)
**Assignee:** Frontend Engineer (React/Tailwind)
**Reference UIs:** `image_ce8de2.jpg`, `image_ce8dca.jpg`
**Focus:** Fixing the broken colored shadow, refining administrative button labels, and replacing the useless activity log with a high-value "Quick Links" forms panel.

## 1. Core Architectural Goal
We need to standardize the card elevations to remove the "glitchy" neon shadows and introduce a dedicated "Generate Official Forms" quick-link section to serve the actual daily needs of DepEd Registrars.

## 2. Frontend Execution (Jegrick/Frontend Team)

### TASK 1: Standardize Card Elevations (Fix the Glow)
Eradicate the glowing blue shadow on the middle action card.
*   **Action:** Audit the `LEARNERS AWAITING SECTIONING` card wrapper. 
*   **Implementation:** Remove any custom `shadow-blue-500/50`, `ring-blue`, or similar utility classes. Ensure all three cards in the top row share the exact same baseline styling: `bg-white border border-gray-200 shadow-sm rounded-lg`. Consistency builds trust with older users.

### TASK 2: Refine Action Button Verbiage
Change the button labels to reflect clear, administrative actions rather than software functions.
*   **Card 1 Button:** Change `OPEN VERIFICATION QUEUE` to `REVIEW PENDING ENROLLEES`
*   **Card 2 Button:** Change `MANAGE SECTIONS` to `ASSIGN LEARNERS TO SECTIONS`
*   **Card 3 Button:** Change `REVIEW CLASS SIZES` to `MONITOR SECTION CAPACITIES`
*   **Section Header:** Change `URGENT ACTION BOARD` to `PENDING ADMINISTRATIVE TASKS`.
