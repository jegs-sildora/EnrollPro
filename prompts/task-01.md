# Prompt for UI/UX & Logic Implementation: Walk-in Encoding Action Placement

## Role & Context
Act as a Frontend Developer. We are integrating an `Encode Walk-in` action into the `SCP Admission` portal. 

In DepEd, Program Coordinators frequently need to manually encode walk-in applicants who did not use the online portal. We need to place this action where it is highly visible when the table is empty, and neatly organized when the table is full, without visually clashing with the existing "Finalize & Lock Roster" button.

## Critical Directive
Implement a dual-placement strategy. Use a dedicated "Empty State" component when there are zero records, and a toolbar button when records exist. Ensure strict state locking so walk-ins cannot be encoded after the roster is finalized.

## UI Component & Layout Requirements

Please implement the following layout and state variations:

### 1. The Zero-Data Empty State (Center Screen)
When the API returns an empty array (no applicants encoded yet):
*   **Layout:** Render a standard Empty State container in the middle of the table body area.
*   **Visuals:** Add a subtle, relevant illustration (e.g., an empty folder or a clipboard).
*   **Copy:** 
    *   *Heading:* `No Applicants Found`
    *   *Subtext:* `There are no applicants currently registered for this program. Wait for online submissions or manually encode a walk-in.`
*   **Action:** Render a large, solid Primary button in the center: `+ Encode Walk-in Applicant`.

### 2. The Populated Table Toolbar (Top Right)
When the table has 1 or more applicants (as seen in the current UI):
*   **Placement:** Inject the button into the top-right action area of the table header, positioned immediately to the *left* of the `Finalize & Lock Roster` button.
*   **Styling (Visual Hierarchy):** Because `Finalize & Lock Roster` is a solid red button, make the `+ Encode Walk-in` button a **Ghost or Outline button** (e.g., transparent background with a primary-colored border and text). This prevents two heavy, solid buttons from competing for the user's attention.
*   **Label:** Keep it concise: `+ Encode Walk-in`.

### 3. State Management (The Roster Lock)
Data integrity is critical. 
*   **Logic:** If the current program's roster status is marked as `LOCKED` or `FINALIZED`, the `+ Encode Walk-in` button MUST be disabled (grayed out) or completely hidden.
*   **Tooltip (Optional):** If disabled, add a hover tooltip stating: *"Cannot encode walk-ins while the roster is finalized."*
*   **Backend Guard:** Ensure the `POST /api/admissions/walk-in` endpoint checks the roster status and rejects the payload with a `403 Forbidden` if the coordinator attempts to bypass the UI lock.