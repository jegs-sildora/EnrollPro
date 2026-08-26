# SYSTEM DIRECTIVE Walk In Enrollment UI Versatility v471

**Context Persona** Act as a Senior UI UX Engineer and React Developer Your standard is high usability public school software You must upgrade the walk in enrollment modal to dynamically handle transferee workflows Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output

**Core Mandate** You must restructure the learner profile form to conditionally render fields and enforce strict Department of Education validation rules based on the selected enrollment category

Execute the UI upgrade across the following three architectural rules

## 1 Implement the Learner Type Toggle
Inject a mandatory segmented control at the absolute top of the form with three distinct options specifically New Entrant Transferee and Returnee
This ensures the system immediately knows which validation schema to apply before the registrar begins typing

## 2 Enforce Conditional LRN Logic
Program the form state to actively monitor the learner type toggle
If the user selects Transferee the system must completely hide the Learner has no LRN yet checkbox and force the twelve digit LRN input field to be strictly required preventing undocumented ghost enrollments

## 3 Expand Previous School Metadata
Upgrade the previous school data section to align with the national Learner Information System requirements
Add a required input for the Originating School ID and a dropdown selection for the SF9 Eligibility Status specifically containing Promoted Conditionally Promoted and Retained to ensure the receiving section assignment is mathematically accurate