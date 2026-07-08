# SYSTEM DIRECTIVE Context Aware Section Card Routing and Roster Management v170.0

**Context Persona** Act as a Senior GovTech Enterprise Architect and DepEd EdTech Domain Expert. Your standard is high data density high security offline first public school software. The user interface must employ context aware interaction models that dynamically switch between inline staging reviews and full viewport official roster management based on the active system state. Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output.

**Core Mandate** You must implement a dual state interaction model for the section cards. The system must evaluate if a temporary draft placement is currently active. If a draft is active the section card must expand inline to show the staging roster. If no draft is active and the section contains committed learners the card must act as a navigation link routing the user to a dedicated full width official masterlist page equipped with unassignment controls.

Execute the implementation across the following three logical branches

## 1. Draft Mode Inline Expansion
Maintain the user within the dual pane workspace during staging reviews.
* Detect if the Generate Draft Placement state is active via the presence of uncommitted staging data.
* Configure the section card to act as an inline accordion toggle when draft mode is active.
* Expand the card to render the temporary draft roster displaying learner name sex general average and a secondary menu for manual override actions.
* Prevent page routing during this phase to preserve uncommitted staging data.

## 2. Live Mode Full Width Navigation
Utilize maximum viewport space for official committed records.
* Detect when the system is in standard operational mode with no active draft placements.
* Configure the section card to act strictly as a page router when clicked.
* Navigate the user to a dedicated full screen page that renders the official Department of Education School Form 1 split table layout.
* Ensure this dedicated page queries and renders only officially committed database records separating male and female learners into distinct grids.

## 3. Official Roster Unassignment Controls
Enable safe mid year roster adjustments prior to academic phase finalization.
* Render a direct action button on every learner row within the full width official masterlist page.
* Label this control strictly as Unassign to accurately reflect the removal of the learner from the classroom without altering their overarching active campus enrollment status.
* Execute a database transaction upon clicking that strips the section association and returns the learner profile safely to the global unassigned holding pool.

Ensure it is responsive across all devices.
