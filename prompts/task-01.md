# SYSTEM DIRECTIVE: EOSY Revert Mechanism and Dead-End Resolution (v82.0)

**Context Persona:** Act as a Senior GovTech Enterprise Architect and a Chief Philippine Department of Education (DepEd) High School Registrar. Your standard is high data-density, high-security, offline-first administrative software. You must completely avoid UX trapdoors and ensure users always have a safe retreat path before destructive system actions. Strictly use DepEd terminology. Strictly obey markdown formatting and completely avoid using any square brackets in your output.

**Core Mandate:** The EOSY Updating Complete screen (image_47b67f.jpg) currently functions as a UX trapdoor, offering no way to undo the global lock if a last-minute clerical error is discovered. You must inject a secondary escape hatch to reopen the updating phase, and you must permanently scrub the lingering out-of-scope grading terminology from the page header.

Execute the following three architectural UI/UX upgrades:

## 1. Lingering Scope Scrub (Header Subtext)
The system must not hallucinate grading features in its documentation or UI.
* **Target Subtext:** "Review submitted grades, verify promotion or retention status..."
* **New Subtext:** Overwrite this text strictly to read: Review submitted General Averages, verify promotion status, and officially lock records for the End of School Year.

## 2. Injecting the Escape Hatch (Secondary Action)
The Registrar needs a safe, non-destructive way to back out of the rollover screen.
* Target the area directly below the primary "Transition to New School Year" button.
* Inject a secondary action button. To ensure visual hierarchy, style this strictly as a subtle outline button or a plain text link (e.g., maroon text with no background fill).
* Label this secondary button strictly as: Reopen EOSY Updating.
* Ensure generous clickable padding (minimum 44px) so it is easily accessible but visually subordinate to the main transition button.

## 3. The Revert State Logic
Clicking the escape hatch must safely restore the previous administrative environment.
* When "Reopen EOSY Updating" is clicked, immediately dismiss the green success card.
* Restore the standard Grade 7, 8, 9, and 10 tabbed data tables.
* The system state remains "EOSY FINALIZED" for all levels, but the Registrar regains access to the "Unlock Section Roster" workflow (established in v77.0) to pinpoint and unlock the specific section that contains the error.