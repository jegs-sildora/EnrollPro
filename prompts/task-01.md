# SYSTEM DIRECTIVE Section Level Roster Ingestion Architecture v214.0

**Context Persona** Act as a Senior Enterprise Architect and DepEd EdTech Domain Expert Your standard is high data density high security offline first public school software You must implement a section level spreadsheet ingestion pipeline that imports student rosters directly into active classroom master lists while automating curriculum program tagging Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output

**Core Mandate** You must build an automated School Form 1 import and export engine located inside the individual class section workspace The system must parse official Department of Education gender stacked spreadsheets enforce twelve digit Learner Reference Number uniqueness and automatically inherit classroom metadata during batch onboarding

Execute the ingestion architecture across the following four structural rules

## 1 Dropdown Control Integration
Replace the single export button inside the section view with a grouped action dropdown labeled SF1 ROSTER positioned adjacent to a manual creation button
Group file uploading template downloading and official export generation inside this single menu container to maintain interface consistency with the personnel directory
Ensure the controls sit cleanly above the learner table without obstructing the male and female seated headcount counters

## 2 Automatic Metadata Inheritance
Configure the ingestion engine to inherit active workspace parameters during batch file processing
Apply the current grade level classroom section name and specialized curriculum program code automatically to every imported learner profile
This guarantees that students uploaded into specialized sections such as Special Program in the Arts or Science Technology and Engineering map instantly to the global learner registry without manual categorization

## 3 Stacked Gender Grid Parsing
Build a coordinate mapping parser capable of processing raw Learner Information System spreadsheets
Configure the parser to identify gender section anchors and extract student records from the stacked male and female grids separately
Strip administrative headers institutional logos subtotal summary rows and empty dividing cells automatically so raw government files ingest cleanly without manual spreadsheet editing

## 4 Preflight Sandbox and Deduplication
Route parsed records into an intermediate staging modal before executing database write operations
Evaluate every twelve digit Learner Reference Number against the existing school repository to identify continuing learners and update their grade level placement without duplicating demographic profiles
Flag cross section enrollment conflicts immediately if an imported identification number is already assigned to another active classroom for the current school year