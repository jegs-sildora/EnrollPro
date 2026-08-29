# Prompt for Development Implementation: Learner Reactivation Workflow

## Role & Context
Act as a Full-Stack Developer. We are building a School Management System for Philippine Department of Education (DepEd) Junior High Schools (Grades 7–10). You need to implement an "Undo" workflow for learners who were mistakenly marked as "Transferred Out" or "Dropped Out." Accuracy is critical as this affects official DepEd forms (SF1 and SF2) and the national Learner Information System (LIS).

## The Objective
Create a "Reactivate Learner" feature that allows System Administrators to safely reverse a student's inactive status while forcing them to provide an audit trail for the change.

## Reference State
Currently, the system has a Learner Directory with an "INACTIVE (TRANSFERRED / DROPPED)" tab. When clicking a learner, the slide-out panel and full Learner Profile display prominent red badges for the inactive status. At the bottom of the profile, there are buttons for "TRANSFERRED OUT" and "DROPPED OUT" but no way to revert the action.

## 1. UI Component Requirements

*   **Action Button:** Add a new button at the bottom of the Learner Profile labeled **"Reactivate Learner"**. 
    *   *Styling:* This should be a secondary button (e.g., outlined, with a neutral or green "active" tint) to contrast visually with the destructive red/orange actions currently there.
*   **Confirmation Modal:** When "Reactivate Learner" is clicked, do not change the status immediately. Trigger a center-screen modal with the following elements:
    *   **Header:** "Reactivate Learner"
    *   **Warning Copy:** "You are about to restore [Learner Name] to the Active Masterlist under [Grade Level & Section]. Please specify the reason for this status change for the official audit logs."
    *   **Required Dropdown (Reason):**
        *   Option 1: *Clerical/Encoding Error*
        *   Option 2: *Transfer Cancelled (Did not proceed)*
        *   Option 3: *Returned to School / Balik-Aral (Within grace period)*
    *   **Alert Box (DepEd LIS Warning):** Include a highlighted informational banner inside the modal: *"Note: If this learner's inactive status was already synced to the national DepEd LIS, you must also manually revert their status in the official LIS portal to prevent discrepancies."*
    *   **Actions:** "Cancel" (Ghost/Text button) and "Confirm Reactivation" (Primary button). Disable the Confirm button until a reason is selected from the dropdown.

## 2. State Management & Frontend Logic

*   **On Confirm:**
    *   Trigger a success Toast notification: *"[Learner Name] has been successfully reactivated."*
    *   Instantly remove all red "TRANSFERRED OUT" or "DROPPED OUT" badges across the UI.
    *   Update the top header badge from "INACTIVE" to "ACTIVE".
    *   Remove the learner from the "INACTIVE" tab list and repopulate them into the "ACTIVE MASTERLIST" tab.

## 3. Backend & Database Logic

*   **Status Update:** Change the learner's database status `is_active` to `true` and clear the `date_transferred_out` or `date_dropped_out` fields.
*   **Class Roster Restoration:** Ensure the student is automatically re-added to their previously assigned Section (e.g., Grade 8 - Matapat) so they immediately reappear on the adviser's School Register (SF1) and Daily Attendance (SF2).
*   **Audit Logging:** Write a new entry to the `Activity Logs` table recording:
    *   Action: "Learner Reactivated"
    *   Target: Learner Reference Number (LRN)
    *   Actor: Current User (e.g., System Administrator ID)
    *   Timestamp: Current System Time
    *   Reason: The specific option selected from the modal dropdown.