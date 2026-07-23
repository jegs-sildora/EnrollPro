# SYSTEM DIRECTIVE Spreadsheet Export Data Remediation v213.0

**Context Persona** Act as a Senior Enterprise Architect and DepEd EdTech Domain Expert Your standard is high data density high security offline first public school software You must remediate the spreadsheet export utility to eradicate placeholder error text populate missing institutional metadata and execute resilient schedule synchronization Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output

**Core Mandate** You must strip all hardcoded fallback error strings from the generated spreadsheet You must ensure unpopulated educational qualifications and schedules render as clean blank cells while populating complete institutional header metadata and building a resilient local database fallback for ATLAS schedule aggregation

Execute the remediation across the following three structural rules

## 1 Placeholder Text Eradication
Remove all hardcoded error strings including NOT ENCODED and NO ATLAS TEACHING LOAD ENCODED from the spreadsheet export utility
Configure the generation script to evaluate database properties cleanly
Ensure that if a faculty profile lacks a secondary minor specialization or an active teaching load the corresponding Excel cell remains completely blank instead of printing internal system warning text

## 2 Institutional Metadata Population
Inject complete institutional identification values into the top metadata grid
Populate the designated data cells in row three and row five with the active campus identification number regional office number school division name and district name
Ensure these metadata values load dynamically from the school configuration profile without blank omissions

## 3 Resilient Schedule Fallback Engine
Upgrade the ATLAS microservice integration client to handle Tailscale network synchronization failures gracefully
Implement a local database lookup that checks the internal teacher designation and advisory ledgers whenever the remote ATLAS endpoint is unreachable over Tailscale
Calculate weekly instructional minutes from this local fallback cache so column Q populates with mathematical durations rather than defaulting to zero


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


# SYSTEM DIRECTIVE Bacolod City Address Selection Architecture v216.0

**Context Persona** Act as a Senior Enterprise Architect and DepEd EdTech Domain Expert Your standard is high data density high security offline first public school software You must configure the cascading address selection dropdowns to handle Bacolod City intuitively for local parents while preserving official Philippine Standard Geographic Code compliance strictly in the backend database Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output

**Core Mandate** You must implement a dual selection capability for Bacolod City on the public enrollment form The user interface must allow parents to locate Bacolod City either through its traditional geographic placement under Negros Occidental or as a standalone highly urbanized administrative entity in the province selection array

Execute the address selection architecture across the following three structural rules

## 1 Geographic Parent Override
Configure the municipality dropdown array to include Bacolod City whenever the user chooses Negros Occidental in the province field
Ensure that parents who naturally identify their home province as Negros Occidental can immediately find Bacolod City listed alongside component cities and municipalities without experiencing filtering errors

## 2 Standalone Province Entry
Inject Bacolod City as an independent entry in the province selection dropdown alongside Negros Occidental Negros Oriental and Siquijor when Negros Island Region is selected
Ensure that if a user chooses Bacolod City directly in the province field the municipality selector automatically locks to Bacolod City and immediately unlocks the sixty one urban and rural barangays

## 3 Backend Code Normalization
Map both frontend selection pathways to the exact same official Philippine Standard Geographic Code in the database transaction layer
Ensure that regardless of whether the parent selected Bacolod City via Negros Occidental or via the standalone entry the saved student profile strictly records the official independent government location code required for national Learner Information System reporting


# SYSTEM DIRECTIVE Master Dashboard Redesign Architecture v217.0

**Context Persona** Act as a Senior Enterprise Architect and DepEd EdTech Domain Expert Your standard is high data density high security offline first public school software You must redesign the master dashboard into a high density operational command center tailored for Junior High School administration Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output

**Core Mandate** You must eradicate the oversized single metric banner and replace it with an analytical workspace displaying curriculum distributions section saturation rates Learner Information System compliance gaps and quick action onboarding controls You must enforce consistent institutional branding across all visual elements

Execute the dashboard upgrade across the following four structural rules

## 1 Spatial Optimization and Top Summary Ribbon
Replace the oversized enrollment hero card with a compact four column top summary ribbon
Allocate equal horizontal width to Total Institutional Enrollment Active Faculty Roster Total Enrolled Sections and Pending System Validations
Embed an interactive action toolbar directly above this ribbon containing rapid execution buttons for Walk In Learner Encoding Batch Spreadsheet Ingestion and Automated Sectioning Triggers

## 2 Institutional Palette Harmonization
Remove bright blue navigation highlights and neon rainbow card backgrounds across the entire workspace
Enforce deep maroon styling for primary navigation states header accents and primary functional buttons
Utilize clean slate gray borders and neutral white backgrounds for data cards to establish a mature professional institutional identity consistent with existing school record modules

## 3 Curriculum and Pipeline Analytics
Inject a structured analytical grid below the summary ribbon to visualize Junior High School enrollment dynamics
Render a distribution breakdown separating standard basic education curricula from specialized programs including Science Technology and Engineering Special Program in the Arts and Special Program in Sports
Display an intake pipeline breakdown comparing early registration cohorts against current walk in enrollees and incoming school transferees across Grade Seven through Grade Ten

## 4 Section Saturation and Compliance Tracking
Integrate an operational health monitor to track classroom saturation and data hygiene
Display an active section capacity tracker that highlights overloaded advisory classrooms exceeding national maximum seat thresholds in bold warning colors
Embed a compliance verification widget that automatically enumerates student profiles lacking valid twelve digit Learner Reference Numbers or mandatory School Form One demographic attributes


# SYSTEM DIRECTIVE Master Dashboard Academic Phase Audit v218.0

**Context Persona** Act as a Senior Enterprise Architect and DepEd EdTech Domain Expert Your standard is high data density high security offline first public school software You must audit the active master dashboard codebase to verify how interface widgets analytics cards and action controls adapt across every academic cycle Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output

**Core Mandate** You must inspect the master dashboard component tree and state management logic to verify how user interface elements behave across all three school year statuses You must output a standalone markdown specification file detailing the exact data visibility and operational permissions enforced during each phase

Execute the codebase verification across the following four audit rules

## 1 Official Enrollment Phase Verification
Scan the codebase for interface behaviors active when the school year status is set to official enrollment
Verify that public enrollment form links are enabled for regular learner acceptance
Document which intake pipeline metrics early registration summaries and section saturation charts are displayed to school registrars during this initial intake period

## 2 Late Classes Ongoing Phase Verification
Scan the codebase for interface adaptations active when the status shifts to classes ongoing late
Verify that the system automatically disables public facing enrollment forms while keeping manual walk in encoding controls accessible to authorized registrars
Document how the dashboard shifts focus from student onboarding analytics to daily attendance tracking section advisership health and classroom capacity alerts

## 3 End of School Year Closing Phase Verification
Scan the codebase for interface behaviors enforced during end of school year closing
Verify that all intake forms and manual encoding actions are strictly locked
Document how the dashboard transforms to display promotion statistics academic deficiency backlogs School Form 5 completion tracking and final grade computation readiness

## 4 Standalone Markdown Audit Output
Generate a new documentation file named DASHBOARD PHASE AUDIT md in the project root directory
Catalog all interface components metrics and action buttons across the three academic cycles
Ensure the generated report clearly maps every dashboard widget to its required visibility state and permission rules across the entire school year lifecycle


# SYSTEM DIRECTIVE Phase Aware Dashboard and Public Routing Architecture v219.0

**Context Persona** Act as a Senior Enterprise Architect and DepEd EdTech Domain Expert Your standard is high data density high security offline first public school software You must integrate the three academic phase workflows into a unified dynamic dashboard interface and configure public enrollment route interception Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output

**Core Mandate** You must replace the static enrollment summary card with a dynamic phase aware workspace that mounts specific operational widgets based on the active school year calendar You must implement a public route interception page that gently guides parents when online registration windows close

Execute the upgrade across the following four structural rules

## 1 Dynamic Workspace Mounting
Implement a state driven workspace container directly below the top summary ribbon
Configure the container to evaluate the active school year calendar phase and mount the corresponding operational widgets automatically
Mount intake queues and seating deficit warnings during official enrollment shift to active tally formulas and serpentine rebalancing alerts during ongoing classes and transition to promotion progress tracking during academic closing

## 2 Branded Public Route Interception
Configure the public enrollment routing layer to intercept external traffic when the academic cycle shifts out of official enrollment
Prevent hard network connection errors or blank screen failures by rendering a professional institutional advisory page
Display the official school crest and notify parents that regular online registration has concluded while instructing late applicants to proceed directly to the campus registrar office for walk in encoding

## 3 Active Tally Formula Visualization
Build a specialized demographic counter for the classes ongoing phase that replaces basic static totals
Visualize the exact Department of Education enrollment formula by displaying the verified baseline figure adding late admissions appended to School Form One and subtracting officially dropped learners
Provide school registrars with immediate visual transparency into daily headcount fluctuations

## 4 Action Toolbar Phase Synchronization
Synchronize the top summary action buttons with the active calendar state
Enable batch spreadsheet ingestion and walk in processing during onboarding phases while locking intake controls and activating final grade monitoring triggers during end of school year closing
This guarantees that administrative controls remain strictly aligned with legal reporting windows


# SYSTEM DIRECTIVE Operational Zero State Persistence Architecture v220.0

**Context Persona** Act as a Senior Enterprise Architect and DepEd EdTech Domain Expert Your standard is high data density high security offline first public school software You must ensure operational workflow cards remain permanently mounted regardless of metric values Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output

**Core Mandate** You must eradicate conditional unmounting for operational dashboard cards You must ensure that pending enrollment queues unsectioned learner trackers and lacking document alerts remain permanently visible even when their numeric count drops to zero You must transform zero value states into clear visual confirmations of administrative completion while preserving navigation pathways

Execute the interface upgrade across the following three architectural rules

## 1 Persistent Component Mounting
Remove all conditional rendering wrappers that unmount dashboard cards when numeric metrics drop to zero
Ensure the pending enrollment tracker the unsectioned learner queue and the documentary requirement alert remain permanently mounted inside the active phase workspace
This guarantees stable visual structure and prevents layout shifting during daily administrative operations

## 2 Positive Zero State Transformation
Configure operational cards to transition into an explicit success state whenever their underlying metric equals zero
Replace warning badges and alert colors with muted institutional borders and positive confirmation labels such as All Active Learners Assigned or Zero Pending Registrations
This provides school registrars with immediate visual proof of data hygiene without triggering system error anxiety

## 3 Navigation Pathway Preservation
Maintain full accessibility to secondary workspace action buttons even during zero value states
Keep buttons such as Assign Class Sections and Process Early Registrants visible so administrators can navigate directly to underlying management tables to review rosters or verify historical records
Style these triggers as secondary outlined controls during zero states to reflect that the primary intake queue is currently clear


# SYSTEM DIRECTIVE Dashboard Phase Mapping and Ingestion Hub Architecture v221.0

**Context Persona** Act as a Senior Enterprise Architect and DepEd EdTech Domain Expert Your standard is high data density high security offline first public school software You must configure legacy phase mapping and global spreadsheet ingestion routing for the master dashboard Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output

**Core Mandate** You must select Option 1 for both prompt dialogs You must map legacy pre registration and beginning of school year enrollment statuses directly into the unified enrollment workspace You must configure the global spreadsheet ingestion button to launch an import chooser modal that directs school registrars to either student roster ingestion or personnel roster ingestion

Execute the configuration across the following two architectural rules

## 1 Legacy Onboarding Phase Mapping
Map legacy pre registration and beginning of school year enrollment database states directly into the official enrollment workspace container
Ensure that when the active academic year exhibits either status the master dashboard mounts the intake analytical queue classroom seating deficit warning and early registration processing tools automatically
Preserve date and phase gate middleware validation so public online enrollment forms open and close strictly according to official Department of Education intake calendars

## 2 Global Ingestion Chooser Modal
Configure the dashboard batch spreadsheet ingestion toolbar trigger to open a compact selection modal
Present school registrars with two clear onboarding pathways inside the modal including Learner Roster Ingestion for School Form One and Faculty Roster Ingestion for School Form Seven
Route the user directly to the designated section staging sandbox or personnel directory uploader upon selection to streamline administrative file processing


# SYSTEM DIRECTIVE Institutional Palette Remediation v222.0

**Context Persona** Act as a Senior Enterprise Architect and DepEd EdTech Domain Expert Your standard is high data density high security offline first public school software You must remediate the visual color palette across the master dashboard and global sidebar navigation strictly enforcing institutional branding Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output

**Core Mandate** You must strip out all default royal blue navigation highlights and blue header accents from the user interface You must enforce deep maroon as the primary active brand color across sidebar indicators icon accents and interactive call to action triggers

Execute the visual remediation across the following three styling rules

## 1 Global Sidebar Active State Styling
Remove the bright royal blue background tint and blue text color from the active sidebar navigation item
Apply a solid deep maroon background fill with clean white contrast text to the active Master Dashboard navigation link
Ensure this deep maroon active state persists across all academic modules to establish unified visual branding

## 2 Dashboard Header and Icon Accents
Purge blue text tints and royal blue icon styling from the summary ribbon cards and quick operation toolbars
Replace informative icon highlights and active numerical counters with deep maroon or slate gray tones that complement the primary institutional theme

## 3 Functional Button Brand Alignment
Inspect all primary interactive triggers across the master dashboard including the quick school operations toolbar buttons
Ensure primary calls to action utilize deep maroon borders or maroon background fills rather than generic default browser tints
This guarantees a professional visual standard appropriate for official Department of Education software


# SYSTEM DIRECTIVE Rollover Remediation and Integration Architecture v228.0

**Context Persona** Act as a Senior Enterprise Architect and DepEd EdTech Domain Expert Your standard is high data density high security offline first public school software You must remediate all vulnerabilities identified in the rollover audit by enforcing strict database atomicity compliance gates and automated testing Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output

**Core Mandate** You must consolidate the end of school year transition into a single database transaction enforce strict readiness gates prevent historical duplication implement dynamic policy driven calendars and construct comprehensive integration test suites

Execute the remediation across the following four structural rules

## 1 Atomic Transaction and Lifecycle Gating
Wrap the entire finalization archival section cloning learner carryover and calendar activation sequence strictly inside a single Prisma transaction block
Reject the rollover request completely if the target school year already contains active operational records
Remove or strictly gate all alternative lifecycle endpoints to prevent administrators from bypassing the unified transition pipeline

## 2 Database Constraints and Archival Prerequisites
Add a unique composite constraint to the enrollment history schema utilizing the learner identification string and the active school year to prevent duplicate historical snapshots
Require strict backend verification that official School Form Five and School Form Six documents were successfully recorded before allowing the system to archive the active school year

## 3 Authoritative Outcomes and Dynamic Calendars
Eradicate hardcoded academic deficiency assumptions and pull final learning area results strictly from the integrated SMART grading database
Store a versioned Department of Education calendar configuration for each academic year to replace hardcoded legacy fallback dates

## 4 Automated Integration Testing
Construct comprehensive automated tests to validate rollover atomicity and database rollback mechanisms
Build test suites to verify the new dynamic calendar logic and ensure the promotion integration accurately parses authoritative SMART outcomes