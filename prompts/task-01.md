# EnrollPro System: Temporal Logic & Phase-Aware Rendering
**Version:** 7.1 (Calendar Synchronization & Readiness UI)
**Assignee:** Jegrick (Frontend) & Patrick (Backend)
**Focus:** Phase-Dependent Database Queries & Conditional UI Rendering

## 1. Core Architectural Goal
The Global System Configuration page (`image_f0e11f.jpg`) is incorrectly displaying End-of-School-Year (EOSY) blockers when the school year has just started (289 days remaining). We must implement strict Phase-Aware Logic. The system should not evaluate or display EOSY blockers until the academic calendar explicitly enters the EOSY phase.

## 2. Backend Execution (Patrick)

### TASK 1: Phase-Gated Readiness Endpoint
*   **The Issue:** Polling for missing SF5s across the entire school during the mid-year `ACTIVE` phase wastes compute.
*   **The Fix:** Update the `GET /api/system/rollover-readiness` endpoint. 
*   **Logic:**
    *   Check the current `school_year_phase` in the database.
    *   If `phase === 'BOSY'` or `phase === 'ACTIVE'`, immediately return a bypass payload: `{ isEosyPhase: false, blockers: [] }`. Do not run the heavy SQL counts.
    *   If `phase === 'EOSY'`, run the full diagnostic queries and return the actual blocker counts: `{ isEosyPhase: true, blockers: [...] }`.

## 3. Frontend Execution (Jegrick)

### TASK 1: Conditional Rendering (The Time Paradox Fix)
Tie the rendering of the `PENDING FINALIZATION TASKS` component directly to Patrick's new payload logic.

*   **State A (Normal Year Operation):** If `isEosyPhase` is false (e.g., 289 days remaining), **do not render the amber warning box at all**. Instead, render a muted, informational state below the button:
    *   *UI:* `<div className="text-sm text-gray-500 mt-4 border-t pt-4">System is in active operation. EOSY rollover diagnostics will become available during the closing phase.</div>`
*   **State B (EOSY Phase Active):** If `isEosyPhase` is true, render the blockers.

### TASK 2: Component De-cluttering
If State B is active, do not use the giant, full-width amber box. Use a clean, modern checklist component.
*   *Container:* `bg-white border border-gray-200 rounded-lg p-6 shadow-sm`
*   *Header:* `text-gray-900 font-semibold text-lg border-b pb-3 mb-4` ("Rollover Readiness Checklist")
*   *Items:* Render blockers as list items with the `⚠️` icon. 
*   *Button Logic:* Keep the `[ Finalize EOSY & Open New School Year ]` button strictly disabled (`cursor-not-allowed opacity-50`) until the blocker array length is exactly `0`.