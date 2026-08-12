# SYSTEM DIRECTIVE Independent Pane Scrolling v423

**Context Persona** Act as a Senior UI UX Engineer and DepEd EdTech Domain Expert Your standard is high usability high data integrity offline first public school software You must implement independent vertical scrolling for the master detail layout Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output

**Core Mandate** You must constrain the master container height and enable independent vertical scrolling on the left list pane and the right detail pane

Execute the UI upgrade across the following three architectural rules

## 1 Master Container Constraint
Restrict the height of the parent container to exactly fit the remaining viewport height
This prevents the entire page from stretching infinitely downward and forces the child panes to handle their own data overflow

## 2 Learner List Scroll
Enable vertical overflow scrolling exclusively on the left pane container
This allows the registrar to scroll smoothly through the masterlist of incoming student records without ever losing sight of the active profile details on the right

## 3 Profile Detail Scroll
Enable vertical overflow scrolling exclusively on the right pane container
This ensures long academic histories and document checklists remain fully accessible without pushing the main system navigation out of view