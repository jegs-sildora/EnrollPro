# System Implementation Logic: Retention and Promotion Rules for Special Programs (STE, SPA, SPS)

This document establishes the system classification rules, performance thresholds, and data-routing logic for learners in Special Curricular Programs—namely the **Special Program in the Arts (SPA)**, **Special Program in Sports (SPS)**, and **Science, Technology, and Engineering (STE)** program. 

---

## 1. System Policy Override: The Obsolete "BEC" Designation
**Crucial Database Update:** Retained or Conditionally Promoted learners originating from special programs **must not** be tagged under the **Basic Education Curriculum (BEC)**. 
* The BEC/RBEC frameworks are long obsolete. 
* Any learner falling below special program thresholds or facing regular academic conditions must be transferred to the current national general stream: the **Regular K to 12 Program** (or the updated **MATATAG Curriculum**, depending on the specific grade level being entered).

---

## 2. Threshold Matrix & System Routing Rules

### A. Retained Status (Complete Program Drop)
* **Trigger Conditions:** 
  1. The learner fails **three (3) or more** academic/regular learning areas, OR
  2. The learner fails their specific **Specialization Subject** (e.g., Arts Specialization, Sports Specialization, or Advanced Science/Math electives), regardless of their general average.
* **System Action Required:**
  * Fully **drop/unenroll** the learner from the special program track.
  * Reclassify curriculum metadata to **Regular K to 12 / General Stream**.
  * Restrict section assignment: Block assignment to any designated STE, SPA, or SPS sections. Force routing into a regular grade-level section to repeat the year or back-subjects.

### B. Conditionally Promoted Status (Program Transfer)
* **Trigger Conditions:**
  1. The learner fails **one (1) or two (2) academic learning areas** but passes their specialization subject, OR
  2. The learner's **Final General Average (FGA)** drops below the strict retention threshold of the special program, even if they passed all individual subjects.
* **Special Program Maintenance Thresholds:**
  * **STE:** Must maintain a Final General Average of at least **85%**, with no individual grade lower than **85%** in Science, Mathematics, and English, and no grade lower than **80%** in other subjects.
  * **SPA / SPS:** Must maintain a Final General Average of at least **83%** to **85%** (subject to specific regional/school manual variations), with no grade lower than **85%** in their Specialization and no grade lower than **80%** in any academic subject.
* **System Action Required:**
  * If a learner passes their specialization but fails up to two regular subjects, OR if their overall average slips below the thresholds above (e.g., FGA falls between 75.00 and 82.99), they are **Conditionally Promoted** to the next grade level but **forfeit their slot** in the special program.
  * Flag the learner profile as **Conditionally Promoted**.
  * Programmatically transfer their curriculum tag from the Special Track to the **Regular K to 12 / General Stream**.
  * **Remedial Scheduler Rule:** The system must require enrollment in remedial classes or completion of re-assessments for the 1 or 2 deficient subjects before or during the upcoming term, handled entirely within a regular class structure.

---

## 3. Comparative Rule Summary Table

| Student Status | Academic Deficiencies | Specialization Status | Performance Threshold | Target Curriculum Mapping | Section Routing Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Retained** | Failed 3 or more academic subjects | Passed or Failed | FGA below 75.00 | **Regular K to 12 / General Stream** | Repeat current grade level in a **Regular Section** only. |
| **Retained (Specialty Fail)** | Passed all or some academic subjects | **Failed** Specialization Subject | Any FGA | **Regular K to 12 / General Stream** | Repeat specialization/grade level requirements in a **Regular Section**. |
| **Conditionally Promoted** | Failed 1 or 2 academic subjects | Passed Specialization Subject | FGA $\ge$ 75.00 but missed program minimums | **Regular K to 12 / General Stream** | Advance to next grade level in a **Regular Section**; enforce remedial class tagging. |

---

## 4. Database Validation and Constraints Script Logic
To automate data integrity within the portal, implement the following validation constraints:

```text
IF (Learner.SpecialProgram IN ['STE', 'SPA', 'SPS']) {
    IF (Learner.FailedSubjectsCount >= 3 OR Learner.SpecializationGrade < 85) {
        SET Learner.Status = 'Retained';
        SET Learner.Curriculum = 'Regular K to 12 / General';
        BLOCK_SECTION_TYPE('SpecialProgramSection');
    }
    ELSE IF (Learner.FailedSubjectsCount IN [1, 2] OR Learner.FinalGeneralAverage < ProgramThreshold) {
        SET Learner.Status = 'Conditionally Promoted';
        SET Learner.Curriculum = 'Regular K to 12 / General';
        SET Learner.RemedialRequired = TRUE;
        BLOCK_SECTION_TYPE('SpecialProgramSection');
    }
}
```