# ARCHITECTURAL SPECIFICATION: Master Enrollment Dashboard
**Document Version:** 8.5 (Pure Live-Data Fetch & SARDO Removal)
**Target View:** Re-hydrating `/dashboard` when `System.AcademicPhase === 'CLASSES_ONGOING'`
**Agent Constraint:** STRICTLY NO RAW HTML, CSS, JSX, OR TAILWIND UTILITY CLASSES. Inherit 100% of DOM skeletons from EnrollPro component library. Apply ONLY the text, token, and live-data bindings below.
**Data Mandate:** STRICTLY NO MOCK DATA. You are forbidden from hardcoding integers, placeholder tallies, or static strings. Every numerical value must be wired directly to the database resolvers defined below.

## 1. HEADER & ACTIVE PHASE BANNER
*   **Page Subtitle:** `Classes Ongoing (Late Enrollment) • S.Y. 2026–2027`
*   **The Calming Blue Status Banner:**
    *   Prefix (Bold inside brackets): `[Academic Phase: Classes Ongoing]`
    *   Body String: `Regular BOSY enrollment is closed. All incoming applications are now automatically tagged and itemized as Late Enrollees.`

---

## 2. ROW 1: THE "PRIVATE INVESTIGATOR" TRIAGE QUEUE
*Enforce equal vertical stretching. Apply the dynamic "✓ Queue Cleared" gray reassurance stamp when any fetched metric === 0.*

*   **Card 1 (Late Intake):**
    *   Card Title: `Late Enrollees to Process`
    *   Sub-badge (Muted gray): `Appends to SF1 Bottom`
    *   Active Button: `Process Late Admissions →`
    *   **Live Data Binding:** strictly fetch `count(Applications where status === 'PENDING' AND is_late_enrollment === true)`.
*   **Card 2 (The Paper Chase):**
    *   Card Title: `Pending Form 137 (SF10)`
    *   Sub-badge (Muted gray): `Awaiting SF10 (In) | Requested (Out)`
    *   Active Button: `Manage Transfer Records →`
    *   **Live Data Binding:** strictly fetch `count(LearnerRecords where sf10_status === 'PENDING' OR sf10_status === 'REQUESTED')`.
*   **Card 3 (Overdue Deficiencies - Replacing SARDO):**
    *   Card Title: `Overdue Documents`
    *   Sub-badge (Muted gray): `Unresolved August Deficiencies`
    *   Active Button: `Follow-up Missing Hardcopies →`
    *   **Live Data Binding:** strictly fetch `count(Learners where is_conditionally_enrolled === true OR count(missing_requirements) > 0)`.

---

## 3. ROW 2: MACRO HEALTH (The Delta Tally & SF4 Vitals)

*   **Left Card (Active School Tally - The "Delta" Resolver):**
    *   Card Title: `Active School Tally`
    *   **The Master Integer:** Render the dynamically computed sum: `(Total_BOSY_Approved) + (Total_Late_Approved)`. Strictly bind its color to the **Primary Theme Token** extracted from the uploaded school logo.
    *   **The Registrar Reassurance Sub-string:** Directly beneath the giant integer, render a dynamically hydrated string template:  
        `{count_BOSY_approved} Official BOSY Baseline • +{count_late_approved} Appended Late Enrollees`
    *   **Grade Breakdown Grid:** Keep the 4 horizontal columns (`Grade 7` to `Grade 10`). For each column, render the primary enrolled count, followed by this dynamically computed sub-string:  
        `(+{count_late_in_this_grade} Late | -{count_dropped_in_this_grade} Dropped)`

*   **Right Card (Monthly Movement Health - School Form 4):**
    *   Card Title: `Monthly Student Movement (SF4)`
    *   **The SF4 Ledger Stack:** Eradicate capacity progress bars entirely. Render a clean, 3-item vertical ledger dynamically bound to the *current calendar month's* movement logs:
        1. `Transferred In (Move In):` bind to `count(SF4_Logs where movement_type === 'TRANSFER_IN' AND month === current_month)` *(Render integer in subtle success green)*
        2. `Transferred Out (Move Out):` bind to `count(SF4_Logs where movement_type === 'TRANSFER_OUT' AND month === current_month)` *(Render integer in muted slate)*
        3. `Dropped Out (Left School):` bind to `count(SF4_Logs where movement_type === 'DROPPED_OUT' AND month === current_month)` *(Render integer in soft gray)*