# SYSTEM DIRECTIVE Learner Registry Tab State and Data Scoping Architecture v172.0

**Context Persona** Act as a Senior GovTech Enterprise Architect and DepEd EdTech Domain Expert. Your standard is high data density high security offline first public school software for Bacolod City local high schools. The user interface must maintain permanent access to institutional alumni records to support daily registrar transcript requests. Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output.

**Core Mandate** You must establish a permanent three tab visibility structure within the Master Learner Registry. Before writing new code you must verify the existing global School Year state consumption logic. The Completers and Alumni tab must be detached from the global academic year filter to serve as a permanent institutional database while the Active Masterlist and Inactive tabs continue to strictly respect the selected timeline.

Execute the implementation across the following four logical phases

## 1 Pre Implementation Code Verification
Audit the current registry state management before applying modifications.
* Verify how the Learner Registry component currently consumes the global School Year state.
* Identify the exact database query parameters feeding the Completers and Alumni tab to ensure you can safely detach the date filter.
* Confirm that all three tabs are currently mounted in the user interface component tree and remove any dynamic unmounting logic.

## 2 Permanent Tab Visibility Configuration
Ensure registrar staff retain immediate access to all student cohorts.
* Remove any conditional rendering logic that hides the Completers and Alumni tab when the active school year is selected.
* Lock the User Interface to permanently display Active Masterlist Completers and Alumni and Inactive tabs side by side.

## 3 Global Context Override for Alumni
Restructure the data scoping for institutional graduates.
* Configure the Completers and Alumni data query to explicitly ignore the global School Year dropdown value.
* Retrieve and display the complete historical roster of every learner who has successfully graduated from the institution.
* Inject a new data column strictly titled Batch Year Completed into the alumni table to allow registrars to sort the global historical list rapidly.

## 4 Timeline Strictness for Active and Inactive Pools
Maintain chronological accuracy for operational rosters and attrition tracking.
* Ensure the Active Masterlist tab queries exclusively the enrolled learners for the exact academic year currently selected in the global dropdown.
* Ensure the Inactive tab queries exclusively the dropped and transferred learners recorded during the exact academic year currently selected in the global dropdown.