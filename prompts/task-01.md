# MODULE: EOSY Finalization - SCP Retention Logic & Alert UI (`/admin/eosy`)
**Tech Stack:** React, Tailwind CSS, Node.js
**Context:** The current system incorrectly calculates Special Curricular Program (SCP/STE) retention solely based on the General Average. It also uses overly aggressive "Error Red" styling for lateral transfer alerts.

## AGENT INSTRUCTIONS: BACKEND LOGIC (Node/Express)
*   **Task:** Update the EOSY status calculation utility for learners flagged as `SCP` or `STE`.
*   **Logic Rules to Enforce:** 
    A learner MUST be flagged for lateral transfer (`PROMOTED (TO BEC)`) if ANY of the following are true:
    1. Final Grade in Science, Math, or English is `< 85`.
    2. Final Grade in any other subject is `< 83`.
    3. ANY quarterly grade in ANY subject is `< 80`.
*   **Payload Requirement:** The API must return an `scpViolationReason` string to the frontend if the learner is transferred to BEC. (e.g., `"Failed to meet 80% minimum in Q2 MAPEH."` or `"Failed to meet 85% final grade in Science."`).

## AGENT INSTRUCTIONS: FRONTEND UI (React/Tailwind)
Execute the following modifications strictly.

### Task 1: Tooltip Redesign (Color & Shape)
*   **Target:** The `SCP Retention Policy Warning` Tooltip component.
*   **Action 1 (Colorization):** Remove the dark red styling (`bg-red-900 text-white`). Apply an Amber Warning theme: `bg-amber-50 border border-amber-300 text-amber-900 shadow-md rounded-md p-4 max-w-xs`.
*   **Action 2 (Typography):** 
    *   Header: Change to `text-xs font-black uppercase tracking-wider text-amber-800 mb-2`.
    *   Body: Change to `text-sm font-medium leading-snug`.

### Task 2: Dynamic Verbiage Injection
*   **Target:** The text inside the newly styled tooltip.
*   **Action:** Execute the following text replacements and inject the dynamic violation reason from the backend.
    *   **New Header:** `Special Program Retention Alert`
    *   **New Body Template:** `Learner will be laterally transferred to the regular Basic Education Curriculum (BEC) next school year. Reason: {learner.scpViolationReason}`
    *   *Example output:* "Learner will be laterally transferred to the regular Basic Education Curriculum (BEC) next school year. Reason: Failed to meet 80% minimum quarter grade in Q2 MAPEH."

### Task 3: The "Contextual Indicator" (Table UI)
*   **Target:** The `GEN AVE` and `EOSY STATUS` columns in the table.
*   **Action:** Since the General Average no longer dictates the transfer, the orange `80.54` text color is misleading. 
    *   Keep the `GEN AVE` text its normal color based on standard grading scales.
    *   Instead, attach a small, subtle Amber Alert Icon (e.g., `<AlertTriangle className="w-4 h-4 text-amber-500 inline-block ml-2"/>`) directly next to the `PROMOTED (TO BEC)` status badge to indicate why they have a specialized status pill. The tooltip should trigger when hovering over this specific status pill or icon.

    # MODULE: EOSY Finalization - Granular SCP Retention Logic & Alert UI (`/admin/eosy`)
**Tech Stack:** React, Tailwind CSS, Node.js
**Context:** The current system incorrectly calculates Special Curricular Program (SCP/STE) retention solely based on the General Average. The UI must be updated to dynamically surface the exact subject, term, and grade that violated the DepEd STE retention policy.

## AGENT INSTRUCTIONS: BACKEND LOGIC (Node/Express)
*   **Task:** Update the EOSY status calculation utility for learners flagged as `SCP` or `STE`.
*   **Logic Rules to Enforce (DepEd Standard):** 
    A learner MUST be flagged for lateral transfer (`PROMOTED (TO BEC)`) if ANY of the following are true:
    1. Final Grade in Science, Math, or English is `< 85`.
    2. Final Grade in any other subject is `< 83`.
    3. ANY quarterly grade in ANY subject is `< 80`.
*   **Payload Requirement:** When returning the learner array, if a learner is flagged for BEC transfer, the API MUST attach an `scpViolation` object containing the exact failure points.
    *   *Data Structure Example:*
```json
        "scpViolation": {
          "subject": "MAPEH",
          "term": "Quarter 2",
          "actualGrade": 78,
          "requiredGrade": 80,
          "violationType": "Quarterly Minimum"
        }
        ```

## AGENT INSTRUCTIONS: FRONTEND UI (React/Tailwind)
Execute the following modifications strictly.

### Task 1: Tooltip Redesign (Color & Shape)
*   **Target:** The `SCP Retention Policy Warning` Tooltip component.
*   **Action 1 (Colorization):** Remove the dark red styling (`bg-red-900 text-white`). Apply a high-contrast Amber Warning theme: `bg-amber-50 border border-amber-300 text-amber-900 shadow-lg rounded-md p-4 w-80`.
*   **Action 2 (Typography):** Set the main header to `text-xs font-black uppercase tracking-wider text-amber-800 border-b border-amber-200 pb-2 mb-2`.

### Task 2: Dynamic Granular Data Injection
*   **Target:** The content structure inside the tooltip.
*   **Action:** Build a structured micro-report utilizing the `scpViolation` object from the backend. Do not just use a flat sentence.
    *   **Header:** `Special Program Retention Alert`
    *   **Body Text:** `Learner will be laterally transferred to the Basic Education Curriculum (BEC) next school year due to the following grade deficiency:`
    *   **Data Grid (Inject below body text):** Render a small, distinct block to highlight the exact grade failure.
```jsx
        <div className="mt-3 bg-amber-100/50 rounded p-2 text-sm">
          <p><span className="font-semibold text-amber-900">Subject:</span> {scpViolation.subject}</p>
          <p><span className="font-semibold text-amber-900">Term:</span> {scpViolation.term}</p>
          <p className="mt-1 text-red-700 font-bold">
            Grade: {scpViolation.actualGrade} <span className="text-amber-700 font-medium text-xs">(Required: {scpViolation.requiredGrade})</span>
          </p>
        </div>
        ```

### Task 3: The "Contextual Indicator" (Table UI)
*   **Target:** The `GEN AVE` and `EOSY STATUS` columns in the table.
*   **Action:** Since the General Average is not the sole trigger, remove any red/orange text coloring from the `GEN AVE` cell unless that specific average is failing.
    *   Attach an Amber Alert Icon (`<AlertTriangle className="w-4 h-4 text-amber-500 inline-block ml-2 cursor-help"/>`) directly next to the `PROMOTED (TO BEC)` status badge. 
    *   The new granular tooltip must trigger *only* when hovering over this specific status badge or warning icon.