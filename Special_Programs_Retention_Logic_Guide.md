# System Implementation Guide: Special Program Retention & Program Reclassification
**Document Reference:** DepEd National Special Programs Policy Realignment  
**Applicable Tracks:** Special Program in the Arts (SPA), Special Program in Sports (SPS), Science, Technology, and Engineering (STE)

---

## 1. Core Logic & Business Rules

### 1.1 Retention & Program Drop Rule
Any learner enrolled in a Department of Education (DepEd) Special Curricular Program (**SPA, SPS, or STE**) who finishes the School Year with a status of **Retained**—or fails to meet the strict retention criteria specified for that track—**MUST** be disqualified from the special program. 

*   **Grade Threshold Rule:** Special programs require a minimum General Average (typically **83% to 85%**) and no failing grades in any academic or specialization subjects. 
*   **Action Required:** If a learner's Final General Average falls below the program line (e.g., failing multiple subjects or earning a failing average like 71.00), the system must flag the account for **Immediate Program Demotion**.

### 1.2 Curriculum Reclassification Rule
*   The system must **NEVER** reclassify a retained or dropped learner into the obsolete Basic Education Curriculum (BEC).
*   The learner must be automatically reclassified into the active **Regular K to 12 / MATATAG Curriculum** stream for their respective grade level.
*   They will repeat the grade level or take back-subjects entirely within a **Regular/General Section**, freeing up slots in highly competitive special program sections.

---

## 2. Step-by-Step System Implementation Protocol

Follow this three-phase process to update the database and portal records for any retained special program learner:

### Phase 1: Enrollment Disqualification & Track Removal
1.  Navigate to the **Learner Enrollment** module under the *Enrollment and Sectioning* menu.
2.  Locate the flagged learner showing multiple learning area deficiencies.
3.  Click the **Action** menu (triple dots) next to the student entry.
4.  Execute the **Unenroll** or **Drop from Special Program** action to remove their active tag from the special track.

### Phase 2: Curriculum Profile Modification
1.  Access the learner's master profile record.
2.  Locate the **Curriculum / Program Type** field.
3.  Modify the dropdown metadata assignment:
    *   *From:* `Special Program in the Arts (SPA)` / `Special Program in Sports (SPS)` / `Science, Technology, and Engineering (STE)`
    *   *To:* `Regular K to 12 Curriculum` (or the active grade-specific general education framework).
4.  Save changes to commit the curriculum reclassification to the database.

### Phase 3: Regular Section Assignment
1.  Navigate to the **Section Assignment** module.
2.  Filter the view by the target Grade Level (e.g., Grade 7) and select **All Programs** or **Regular Curriculum**.
3.  Verify that the learner's profile displays their updated general curriculum classification.
4.  **Do not** assign the learner to an elite program block (such as specialized SPA, SPS, or STE sections).
5.  Route and commit the learner to an open, available **Regular Grade Section**.

---

## 3. Summary Mapping Table

| Special Program | Retention Trigger | Post-Drop Curriculum Assignment | Allowed Section Assignment |
| :--- | :--- | :--- | :--- |
| **SPA** (Arts) | Specialization < 85% OR Gen. Ave < 83% OR Retained | Regular K to 12 / MATATAG | **Regular Sections Only** (No SPA Blocks) |
| **SPS** (Sports) | Specialization/Skill < 85% OR Gen. Ave < 83% OR Retained | Regular K to 12 / MATATAG | **Regular Sections Only** (No SPS Blocks) |
| **STE** (Science) | Science/Math/ICT < 85% OR Gen. Ave < 85% OR Retained | Regular K to 12 / MATATAG | **Regular Sections Only** (No STE Blocks) |
