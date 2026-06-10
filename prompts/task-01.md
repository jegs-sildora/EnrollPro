Act as a Senior UI/UX Engineer.

MISSION: Optimize Direct Encode Drawer for High-Speed Data Entry and Prevent Data Loss
The Walk-In Direct Encode slide-over utilizes standard component behaviors that introduce friction and data-loss risks during rapid administrative encoding. You must lock the panel state, remove collapsible friction, and implement keyboard-first auto-fetching.

Execute the following layout and interaction mandates exactly:

TASK 1: Prevent Accidental Data Loss (State Lock)

Disable the closeOnOverlayClick and closeOnEsc properties of the drawer component.

If the user clicks the explicit [ CANCEL ] button or the [ X ] close icon, evaluate the form state. If the form is "dirty" (fields have been altered), trigger a browser confirmation alert: "Are you sure you want to discard this encoding session? Unsaved data will be lost."

TASK 2: Eliminate Accordion Friction

If the section headers (1. LEARNER PROFILE, 2. PREVIOUS SCHOOL DATA, etc.) are functioning as collapsible accordions, force their default state to fully expanded.

Alternatively, remove the toggle functionality entirely so they function strictly as visual dividers.

TASK 3: Implement Keyboard-First LRN Fetching

Remove the requirement to manually click the magnifying glass icon to search the LRN.

Attach the fetch function to the onBlur event of the LRN input, or auto-trigger it when exactly 12 numeric characters are detected. This allows the registrar to seamlessly Tab to the next field while the system pre-fills the rest of the form in the background.

TASK 4: Enforce Tab-Indexing

Ensure strict sequential tabIndex ordering from top to bottom so the registrar can encode the entire physical form using only the keyboard, ending on the Enter key to trigger the Save action.