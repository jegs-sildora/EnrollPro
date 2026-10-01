# Prompt for Backend Implementation: Chaining Auto-Sectioning to EOSY Rollover

## Role & Context
Act as a Full-Stack / Backend Developer. We are fixing a critical automation bug in the End of School Year (EOSY) Rollover script for our DepEd JHS system.

Currently, when the system rolls over to the new school year, it successfully promotes Grades 7–9 learners and generates their new `EnrollmentApplication` records with a `PENDING_CONFIRMATION` status (which renders as `PRE-REGISTERED` in the UI). However, it drops them into the unassigned pool. 

According to DepEd's automatic pre-registration policy, these continuing learners must be automatically placed into draft sections based on their Final General Average *before* the Grade Coordinators even log in.

## Critical Technical Directive
You must chain the existing Auto-Sectioning Service to the end of the EOSY Rollover Service. The rollover process is not complete until every `PRE-REGISTERED` learner for Grades 8, 9, and 10 has a corresponding `EnrollmentRecord` tying them to a specific Section.

## Backend Logic & Implementation Requirements

Please update the `rolloverService` (or equivalent background job) to execute the following phases sequentially:

### Phase 1: Promotion & Application Generation (Existing)
*   Ensure the script continues to create `EnrollmentApplication` records for promoted learners with `status = 'PENDING_CONFIRMATION'`.

### Phase 2: Automated Batch Sectioning (The Missing Link)
Immediately after Phase 1 completes successfully, the script must trigger the auto-assign logic for Grades 8, 9, and 10:
*   **Step 2A: Fetch Config.** Query the `SchoolSetting` table for the `sectioning_rules` (Top BEC count and Regular BEC distribution mode).
*   **Step 2B: Fetch Pool.** For each grade level, fetch all applications created in Phase 1.
*   **Step 2C: Fetch Targets.** Fetch all active `Sections` for that grade level in the new active school year.
*   **Step 2D: Execute Algorithm.** Run the sorting algorithm (separating SCP, Top BEC, and distributing Regular BEC based on the school's configured logic).

### Phase 3: Database Commits (Draft Roster Generation)
*   For each learner placed by the algorithm, create an `EnrollmentRecord` in the database.
*   Ensure these records correctly reference the `section_id` and the `application_id`. 

### Phase 4: Frontend Manual Override (Safety Net)
*   In the event the backend job crashes halfway through, the UI must still allow the user to fix it manually.
*   Ensure the `RE-RUN SECTIONING ALGORITHM` button on the frontend is capable of capturing these unassigned `PRE-REGISTERED` learners from the left pane and pushing them through the exact same sorting algorithm on demand.