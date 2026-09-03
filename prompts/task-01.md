# Prompt for UI/UX Implementation: Revert Enrollment Workflow

## Role & Context
Act as a Frontend Developer. We are updating the "Learner Enrollment" module for EnrollPro, a DepEd Junior High School management system. 

Currently, in the "INCOMING GRADE 7 AND TRANSFEREES" tab, when a learner is successfully moved to the `ENROLLED` queue, the right-hand detail pane becomes read-only with no action buttons. We need to implement a clerical "Undo" workflow that allows registrars to reverse an enrolled student back to the `FOR REVIEW` queue in case of an encoding error.

## The Objective
Add a secure "Revert to For Review" action in the right-hand panel for learners in the `ENROLLED` state, complete with a confirmation modal and audit logging.

## UI Component Requirements

### 1. The Trigger Action (Right Panel)
*   **Placement:** At the bottom of the right-hand summary table (below the "Required Documents" section), anchor a new action button container.
*   **Button UI:** Add a secondary/ghost button labeled **`Revert to 'For Review'`** or **`Undo Enrollment`**. 
*   **Styling:** Use a muted or warning-colored text/border (e.g., a dark orange or standard gray ghost button) to indicate it is a corrective administrative action, avoiding the heavy red of a "Delete" button.

### 2. The Confirmation Modal
Clicking the button must trigger a center-screen modal to prevent accidental reversals.
*   **Header:** `Revert Enrollment Status`
*   **Warning Copy:** `You are about to reverse the enrollment for [Learner Name]. This will remove them from the 'Enrolled' list and place them back into the 'For Review' queue. They will not be available for Section Assignment.`
*   **Required Dropdown (Reason):**
    *   Option 1: *Clerical / Encoding Error*
    *   Option 2: *Pending Additional Document Verification*
*   **Actions:** 
    *   `Cancel` (Ghost button - closes modal)
    *   `Confirm Reversal` (Primary warning button). Disable until a reason is selected.

## State Management & Database Logic

### Frontend State (On Confirm):
*   **Notification:** Show a success Toast: *"[Learner Name] has been reverted to the For Review queue."*
*   **List Update:** Instantly remove the learner's card from the `ENROLLED` tab list.
*   **Counter Update:** Decrement the `ENROLLED` tab counter by 1, and increment the `FOR REVIEW` tab counter by 1.
*   **Pane Reset:** Clear the right-hand viewing pane to an empty state.

### Backend/Database Logic:
*   **Status Update:** Change the learner's enrollment status column in the database from `ENROLLED` back to `PENDING_REVIEW`.
*   **Audit Logging:** Write a new entry to the `Activity Logs` table recording:
    *   Action: "Enrollment Reverted to Review"
    *   Target: [Learner Name] / LRN
    *   Actor: Current User ID
    *   Reason: The specific option chosen from the modal dropdown.