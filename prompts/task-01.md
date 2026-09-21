# Prompt for UI/UX & Logic Implementation: LRN Lookup & Curricular Program Locking

## Role & Context
Act as a Full-Stack Developer. We are implementing the core data-binding logic for the `Online Enrollment Form`.

Currently, the `Learner Reference Number (LRN)` input simply acts as a text field, and the `Preferred Curricular Program` is a free-choice dropdown. We need to implement an auto-fetch mechanism where entering a valid 12-digit LRN queries the backend for the student's existing records (specifically their SCP Admission status) and strictly locks their program eligibility to prevent unauthorized enrollment in restricted programs.

## Critical Directive
Data integrity is the priority. The `Preferred Curricular Program` must transition from an open user choice to a strict system-computed, read-only field based on the LRN fetch results. 

## UI Component & Logic Requirements

Please implement the following behavior and validation workflow:

### 1. The LRN Lookup Trigger
*   **Validation:** The LRN input field must strictly accept exactly 12 numeric digits. 
*   **Trigger:** Once the 12th digit is entered (or on `blur` if 12 digits are present), automatically trigger a `GET` request to fetch the learner's pre-enrollment/admission profile.
*   **Active State:** While fetching, disable the input and render a small inline loading spinner inside or next to the LRN input.
*   **Success UI:** If found, render a small green checkmark inside the input and a helper text: *"Learner record found. Auto-filling form..."*

### 2. Auto-filling Personal Information
*   Upon a successful fetch, automatically populate the `Last Name`, `First Name`, and any other available demographic fields.
*   **UX Polish:** Apply a brief visual highlight (e.g., a subtle green flash or border transition) to the auto-filled fields so the user understands the system did the work for them. 

### 3. Smart Locking: The "Preferred Curricular Program"
This is the most critical validation step. The system must evaluate the fetched `scp_admission_status` and lock the dropdown accordingly.

*   **Condition A: The Qualified SCP Learner**
    *   *Logic:* If the fetched LRN exists in the locked SCP Admission roster with a status of `QUALIFIED` for a specific program (e.g., STE).
    *   *UI:* Programmatically set the dropdown value to that specific program (`SCIENCE, TECHNOLOGY AND ENGINEERING`). 
    *   *Locking:* Apply the `disabled` or `read-only` prop to the dropdown. The user CANNOT change it.
    *   *Helper Text:* Render a green success message below the field: *"Verified: Learner is officially qualified for this program."*

*   **Condition B: The Regular / Disqualified Learner**
    *   *Logic:* If the fetched LRN has NO admission record, OR their admission record is `DISQUALIFIED`, `FORFEITED`, or `WAITLISTED` (not yet promoted).
    *   *UI:* Programmatically set the dropdown value to `REGULAR BASIC EDUCATION CURRICULUM (BEC)`.
    *   *Locking:* Apply the `disabled` or `read-only` prop to the dropdown.
    *   *Helper Text:* Render a muted information message below the field: *"Assigned to Regular BEC based on admission records."*

*   **Condition C: "Learner has no LRN yet"**
    *   *Logic:* If the user checks the radio button `Learner has no LRN yet` (meaning they are a completely new entrant without prior DepEd tracking).
    *   *UI:* They automatically bypass the SCP lookup (since SCP requires prior records/screening). Force-set and lock the dropdown to `REGULAR BASIC EDUCATION CURRICULUM (BEC)`.

### 4. Backend Validation (The Ultimate Safeguard)
*   Do not rely solely on the frontend disabled dropdown. 
*   When the enrollment form is submitted via `POST`, the backend MUST independently re-verify the LRN against the finalized SCP Admission roster. 
*   If a malicious user intercepts the payload and tries to submit `program: "STE"` for an LRN that is not explicitly marked as `QUALIFIED` in the admission table, the backend must reject it with a `403 Forbidden` error.