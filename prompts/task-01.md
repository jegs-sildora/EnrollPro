# Prompt for UI/UX Copywriting: DepEd Localization & Layman's Terms

## Role & Context
Act as a Frontend Developer. We are executing a strict copywriting and text-replacement pass on the `/track-application` portal for the Admission phase.

Currently, the portal uses robotic, corporate-sounding system text (e.g., "Awaiting prior steps", "Document Verification"). We need to translate all UI text into standard DepEd (Department of Education) terminology and warm, layman's terms so parents and students can easily understand their exact status without needing to call the school.

## Critical Directive
Do NOT change any UI layouts, colors, or icons. This is purely a text/string replacement task. Update your state dictionaries to use the exact strings provided below.

## 1. Hero Banner Copy (Dynamic Updates)

Replace the existing Hero Banner states with these localized, conversational strings:

*   **If Step 1 is Active:**
    *   *Title:* `SUBMISSION OF REQUIREMENTS`
    *   *Subtitle:* `Please bring your physical documents (SF9/Report Card, PSA, etc.) to the school for checking.`
*   **If Step 2 is Active:**
    *   *Title:* `WAITING FOR TEST / AUDITION RESULTS`
    *   *Subtitle:* `The committee is currently computing the scores from the admission test or audition.`
*   **If Step 3 is Active:**
    *   *Title:* `INTERVIEW PHASE`
    *   *Subtitle:* `Waiting for the final evaluation from your parent-teacher interview.`
*   **If Step 4 is Active (Terminal States):**
    *   *Qualified Title:* `QUALIFIED FOR [PROGRAM NAME]`
    *   *Waitlisted Title:* `WAITLISTED FOR [PROGRAM NAME]`
    *   *Not Qualified Title:* `NOT QUALIFIED`

## 2. Timeline Stepper Copy (The 4 Steps)

Replace the titles and dynamic subtexts in the vertical stepper with the following:

### Step 1: Checking of Requirements
*(Replaces "Document Verification")*
*   **Active Subtext:** "Please submit your SF9, PSA Birth Certificate, and other requirements to the assigned office."
*   **Completed Subtext:** "All documents have been submitted and verified."

### Step 2: Admission Test / Audition
*(Replaces "Examination / Audition")*
*   **Upcoming (Locked) Subtext:** "Must submit and pass the documentary requirements first."
*   **Active Subtext:** "Waiting for the scheduled test/audition or the release of results."
*   **Completed Subtext:** "Passed the admission test/audition."

### Step 3: Interview
*(Replaces "Panel Interview")*
*   **Upcoming (Locked) Subtext:** "Must pass the admission test/audition first." *(Replaces the robotic "Awaiting prior steps")*
*   **Active Subtext:** "Waiting for the scheduled interview with the applicant and parents/guardians."
*   **Completed Subtext:** "Interview completed."

### Step 4: Final Screening Result
*(Replaces "Final Admission Result")*
*   **Upcoming (Locked) Subtext:** "Waiting for the official posting of qualified applicants."
*   **Qualified (Green):** "Congratulations! You are officially qualified. Please proceed to the Online Enrollment Form."
*   **Waitlisted (Yellow):** "Passed the screening, but placed on the waitlist due to limited slots."
*   **Not Qualified (Red):** "Did not meet the cut-off. Please proceed to enroll in the Regular Basic Education (BEC) program."

## 3. Empty States & Helpers
*   **Search Placeholder:** Update the input placeholder to: `Enter Tracking Number (e.g., STE20260000001)`
*   **Action Button (Inside Step 4):** Change `Proceed to Official Enrollment` to `Enroll Now` for brevity and action-orientation.