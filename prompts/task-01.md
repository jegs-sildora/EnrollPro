# COPY SPECIFICATION: DepEd LIS Phase Rollover Modals (v25.1)
**Target:** Global System Configuration -> Modal Dialog Overrides
**Mandate:** Completely purge the collegiate word "Intake". Align all modal headers, prose, and button labels strictly with official DepEd LIS and School Form (SF) terminology.

---

## INSTANCE 1: Activating "Official Enrollment" (image_6451e8.jpg)
*Triggered when selecting Radio #1*

*   **Modal Header:** `Open Regular Enrollment Period?`
*   **Body Paragraph 1:** `You are about to open the official enrollment portals for School Year 2026–2027.`
*   **Body Paragraph 2:** `Confirming this activates encoding for incoming Grade 7, Transferees, and Balik-Aral learners. The system will begin staging learner profiles for Beginning of School Year (BOSY) LIS tagging.`
*   **Footer Warning:** *(Leave blank)*
*   **Button Lockup:**
    *   Secondary (Grey): `[ Keep Enrollment Closed ]`
    *   Primary Action (Solid Blue): `[ Open Regular Enrollment ]`

---

## INSTANCE 2: Shifting to "Classes Ongoing / Late Enrollment" (image_6451c5.jpg)
*Triggered when selecting Radio #2*

*   **Modal Header:** `Close Regular Enrollment & Tag Late Enrollees?`
*   **Body Paragraph 1:** `You are officially closing the regular enrollment window to mark the start of ongoing classes.`
*   **Body Paragraph 2:** `The public forms will remain open, but all learners encoded after today will be permanently flagged as "Late Enrollees" for BOSY LIS reporting.`
*   **Footer Warning:** `LIS POLICY: Reverting a Late Enrollee timestamp requires an overriding Administrative pass.`
*   **Button Lockup:**
    *   Secondary (Grey): `[ Keep Regular Enrollment Open ]`
    *   Primary Action (Amber / Warning): `[ Begin Classes & Tag Late Enrollees ]`

---

## INSTANCE 3: Shifting to "EOSY Closing" (image_6451ca.jpg)
*Triggered when selecting Radio #3*

*   **Modal Header:** `Initiate EOSY Finalization & System Lock?`
*   **Body Paragraph 1:** `You are locking the active database to begin End of School Year (EOSY) updating.`
*   **Body Paragraph 2:** `This freezes learner encoding across all grade levels to prepare official School Form 5 (Report on Promotion) and School Form 6 (Summarized Report) for Division submission.`
*   **Footer Warning:** `CRITICAL LIS GATE: Do not proceed until all class advisers have finalized their SMART electronic class records.`
*   **Button Lockup:**
    *   Secondary (Grey): `[ Keep School Year Active ]`
    *   Primary Action (Crimson / Danger): `[ Lock System for EOSY Updating ]`