# Prompt for UI/UX & Logic Implementation: SCP Slot Forfeiture & Roster Reconciliation

## Role & Context
Act as a Full-Stack Developer. We are implementing the Slot Forfeiture and Roster Reconciliation workflows on the `SCP Admission` portal. 

In DepEd public schools, SCP rosters (STE, SPA, SPS) have strict capacity limits (e.g., Top 50 only). When a `QUALIFIED` learner withdraws or "ghosts" the official enrollment period, the Program Coordinator must be able to officially forfeit that learner's slot and promote the next student from the `WAITLISTED` pool. Furthermore, we must ensure that forfeiting or failing an SCP exam does not ban the learner from enrolling in the school's Regular BEC track.

## Critical Directive
Never delete an admission record. When a learner withdraws or is forfeited, their record must be retained for audit purposes, but their state must change to free up the slot. The UI must facilitate a smooth "Waitlist Promotion" to fill the newly opened capacity.

## UI Component & Logic Requirements

Please implement the following row-level actions and state changes:

### 1. The "Forfeit Slot / Withdraw" Action
For any learner currently marked as `QUALIFIED` or `WAITLISTED` who has not yet officially enrolled:
*   **Placement:** Inside the row-level ellipsis menu (`...`) on the far right of the data table.
*   **Menu Item:** Add an action labeled `Forfeit Slot / Withdraw`. Use a warning color (red or dark orange) for the icon/text.
*   **Condition:** This action must be disabled or hidden if the learner's micro-badge already says `Officially Enrolled`. (Once enrolled, dropping them follows the Drop-Out/NLPA process, not admission forfeiture).

### 2. The Confirmation Modal
When `Forfeit Slot / Withdraw` is clicked, trigger a strict confirmation modal.
*   **Title:** `Confirm Slot Forfeiture`
*   **Body Text:** *"Are you sure you want to forfeit this learner's SCP slot? This action will permanently remove them from the qualified list and free up a slot for a waitlisted applicant. This learner will still be allowed to enroll in the Regular Basic Education Curriculum (BEC)."*
*   **Action Buttons:** `Cancel` (Ghost) and `Confirm Forfeiture` (Solid Red).

### 3. Visual State: The "Forfeited" Roster
Once the backend processes the forfeiture:
*   **New Section/Category:** Below the `UNQUALIFIED APPLICANTS` section, dynamically render a new group header: `WITHDRAWN / FORFEITED APPLICANTS`.
*   **Row Styling:** Move the learner to this section. Change their `FINAL RESULT` badge to a gray/muted `FORFEITED` badge. Apply a subtle opacity reduction (e.g., `opacity-60`) or a strike-through to the row so it recedes visually.

### 4. The Ripple Effect: Waitlist Promotion UI
When a `QUALIFIED` slot is forfeited, the system's capacity count drops (e.g., from 50/50 to 49/50).
*   **Smart Prompt:** Immediately after a successful forfeiture, trigger a Toast or small Modal: *"Slot opened. The roster is now at 49/50 capacity. Would you like to promote the highest-ranking Waitlisted applicant?"*
*   **Manual Promotion:** Ensure the ellipsis menu (`...`) for `WAITLISTED` learners includes a `Promote to Qualified` action. Clicking this updates their state to `QUALIFIED`, moves them to the top section, and assigns them the `PENDING LESF SUBMISSION` micro-badge.

### 5. Backend Logic: The Regular BEC Fallback
Update the `POST /api/enrollment` (Enrollment Submission) validation logic.
*   If a learner attempts to submit a General Enrollment form, the backend must check their `ScpAdmission` status. 
*   If their status is `DISQUALIFIED` or `FORFEITED`, the system MUST allow the enrollment to proceed, but seamlessly force their `curricular_program` payload to default to `Regular BEC`.