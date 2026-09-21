# Prompt for UI/UX & Logic Implementation: Waitlist Management & Slot Forfeiture

## Role & Context
Act as a Full-Stack Developer. We are implementing the "Waitlist Promotion" workflow on the locked `SCP Admission` page. 

Currently, when an SCP roster is locked and the `Max Learner Slots` are filled, the system correctly tags excess passing applicants as `WAITLISTED`. In reality, top applicants often enroll elsewhere, freeing up slots. We need a safe, controlled mechanism for registrars to mark a qualified student as "Forfeited," which must trigger the system to automatically promote the next highest-ranking waitlisted learner to fill the empty slot.

## Critical Directive
Do not require the user to "Unlock Roster" to perform this action. Unlocking exposes the entire table to accidental edits. Instead, implement targeted row-level actions using existing design system components (Dropdown menus, Modals, Badges) while the table remains in its globally locked state.

## UI Component & Logic Requirements

Please implement the following workflow:

### 1. Row-Level Action: Mark as Forfeited
*   **Target:** Render a row-level action (e.g., a standard kebab/three-dot menu icon, or a small ghost button) ONLY on rows where the `FINAL RESULT` is `QUALIFIED`.
*   **Action Label:** `Forfeit Slot`.
*   **Visibility:** This action must be visible and clickable even when the global roster is "Finalized and Locked".

### 2. The Confirmation Modal (Critical Safety Check)
Clicking `Forfeit Slot` must trigger a standard system Confirmation Modal to prevent accidental clicks.
*   **Title:** `Forfeit Applicant Slot?`
*   **Body:** `Are you sure you want to forfeit [Applicant Name]'s slot in this program? This action is irreversible. The system will automatically promote the highest-ranking waitlisted applicant to fill this empty slot.`
*   **Actions:** `Cancel` (Ghost) | `Confirm Forfeiture` (Destructive/Primary).

### 3. Backend Logic: The Cascading Promotion Algorithm
Upon confirmation, the backend must execute the following atomic transaction:
1.  **Update the Forfeiter:** Change the target applicant's status from `QUALIFIED` to `FORFEITED`. 
2.  **Identify the Next-in-Line:** Query the database for the highest-ranking applicant in the same program whose status is `WAITLISTED` (sorted descending by `Written Exam Score`, then `Gen Ave` as the tie-breaker).
3.  **Promote:** Update that specific waitlisted applicant's status from `WAITLISTED` to `QUALIFIED`.
4.  *Edge Case:* If there are no waitlisted applicants left, simply leave the slot open (e.g., the tracker now reads "1 out of 2 filled").

### 4. UI Table Refresh & Badge Updates
Once the backend transaction succeeds, refresh the frontend table to reflect the new reality:
*   **Re-sort the Table:** The newly `FORFEITED` applicant must drop down to the bottom section (group them with the Unqualified applicants). The newly `QUALIFIED` applicant must move up into the "TOP QUALIFIED" section.
*   **Badge Updates:** 
    *   Render a new distinct Status Badge for the dropout: `FORFEITED` (Use a gray or dark outline style to differentiate it from a standard failure).
    *   The promoted applicant's badge smoothly updates from `WAITLISTED` to `QUALIFIED`.
*   **Audit Trail (Optional but Recommended):** Consider adding a small tooltip to the promoted applicant's badge that says: *"Promoted from Waitlist on [Date]"*.