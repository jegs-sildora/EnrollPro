# System Prompt: Refactor Early Registration Masterlist Data Flow & UI States

**Role:** Senior React/Next.js UI Engineer & DepEd JHS Domain Expert

## Context
We have a critical domain logic error in the "Early Registration Masterlist" component (`image_9d2d18.jpg`). Currently, the list behaves like a disappearing task queue—when a registrar clicks "Review Form" and officially enrolls the learner, the record is deducted/removed from the masterlist view. 

**Domain Insight:** In DepEd public schools, an Early Registration list is a permanent headcount ledger. Registrars use this list months later to track enrollment conversion (i.e., identifying early registrants who failed to show up for official enrollment). Removing processed learners destroys this historical data.

## Task
Refactor the Masterlist UI to utilize a status-driven data flow rather than a deletion/deduction model. The learner must remain on the list permanently, but their UI state must visually communicate that they have been processed.

## Design & Logic Constraints (CRITICAL)

### 1. Introduce Tabbed Filtering
To prevent the main view from becoming cluttered with processed records, implement a tabbed navigation structure below the main "INCOMING GRADE 7" header.
*   **Tabs:** "Pending Review" (Default Active), "Officially Enrolled", "Cancelled/No Show", and "All Registrants".
*   **Logic:** The system should filter the displayed table rows based on the selected tab without mutating the underlying dataset.

### 2. Implement Status Badges
Inject a new "Status" column into the data table, or append a status badge directly beneath the "LEARNER NAME & LRN" column.
*   **Pending:** `<Badge variant="warning">Pending Enrollment</Badge>`
*   **Processed:** `<Badge variant="success">Officially Enrolled</Badge>`

### 3. Action Button State Mutation
The primary action button must react to the learner's current enrollment status to prevent double-processing.
*   **If Status === 'Pending':** Render the primary maroon button as "Review Form" (Current state).
*   **If Status === 'Officially Enrolled':** Change the button to a secondary/outline variant (e.g., `<Button variant="outline">`) and change the label to "View Learner Profile". The route should now point to their official enrollment record, not the early registration review panel.

## Output Requirement
Provide the updated React component code for the Masterlist. Focus specifically on implementing the state-driven row rendering, the tabbed filter logic, and the conditional rendering of the action buttons based on the learner's status. Use existing design system components (`<Tabs>`, `<Badge>`, `<Button>`).