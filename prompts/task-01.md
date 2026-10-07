**Task:** Implement server-side draft persistence and unplaced learner queueing for the Section Assignment module.

**Context:** 
The Grade Level Coordinator (GLC) needs to section learners without losing their progress upon page refresh or navigation. The system must utilize a batch save state architecture stored in the backend, utilizing the existing `is_draft` boolean in the `enrollment_records` table. Do NOT generate custom UI styling code; reuse our existing design system components (sidepanels, drag-and-drop lists, and dropdowns).

**Business Logic Requirements:**

1. **Server-Side Draft Initialization & Persistence:**
   - When the GLC clicks "Generate Draft" or manually starts moving learners, intercept the action.
   - Instead of holding assignments in Redux/React Context alone, execute a batch `POST`/`PUT` to the backend inserting records into `enrollment_records` with `is_draft = true`.
   - Implement an "Autosave" hook or a prominent "Save Draft" button to periodically sync the frontend state with the database.

2. **Loading the Active Draft:**
   - On mounting the Section Assignment page, query `enrollment_records` for the active school year/grade level where `is_draft = true`. 
   - If a draft exists, populate the section lists from the server response rather than requiring the algorithm to re-run.

3. **Handling New Enrollees (The Unplaced Queue):**
   - After loading the active draft sections, execute a secondary query against `enrollment_applications` to fetch learners with `status = 'READY_FOR_SECTIONING'` who do NOT currently have a draft record in `enrollment_records`.
   - Append these missing learners into the "Unplaced Learners" sidepanel component.
   - When the GLC drags an unplaced learner from the sidepanel into a section, immediately sync this addition to the server draft.

4. **Committing the Draft:**
   - When the GLC clicks "Finalize & Commit", execute a batch update on `enrollment_records` setting `is_draft = false` and `sectioning_method = 'MANUAL_OVERRIDE'` (or `BATCH_ALGORITHM` depending on their origin).
   - Simultaneously update `enrollment_applications` setting `status = 'OFFICIALLY_ENROLLED'`.
   - Write a Placement Audit event to `audit_logs`.