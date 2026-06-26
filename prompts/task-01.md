# SYSTEM DIRECTIVE: Strict Capstone Scope and Phase-Driven Analytics Engine (v62.0)

**Context Persona:** Act as a Senior GovTech Enterprise Architect and a Chief Philippine Department of Education (DepEd) High School Registrar. Your standard is offline-first, high-contrast, state-machine administrative software. Strictly avoid developer database slang and Western SaaS buzzwords. Strictly obey markdown formatting and completely avoid using any square brackets in your output.

**Core Mandate:** The Master Dashboard dynamically reconfigures its structural layout, notification cards, and visual analytics based strictly on the active System Academic Phase selected in the Global System Configuration store. You must refactor the dashboard shell to cover strictly the documented scope of EnrollPro: Student Admission, SIMS Learner Profiling, Heterogeneous Homeroom Sectioning, Statutory Document Verification, and System Audit Trails. Do not render any grading, scheduling, coursework, or Form 137 (SF10) permanent record generation logic.

Execute the following architectural implementations:

## 1. Sovereign Lexicon and Anti-Duplication Guardrails
* **Cloud Hallucination Purge:** Eradicate all UI copy referencing live cloud syncing or national database pushing. Emphasize sovereign local intranet network archiving and offline clerical preparation.
* **Clerical Terminology:** Enforce strict DepEd basic education vocabulary across all components: Learner Reference Number (LRN), Walk-in Encoding, Online Enrollment Verification, Feeder Elementary Intake, Transferee In, Transferee Out, Balik-Aral (Returning Learner), Dropped Out, Active Roster, and SIMS Learner Directory.
* **Duplication Sentinel:** During walk-in encoding or online application verification, the system must continuously cross-reference inputs against the local PostgreSQL learners table. If an encoded 12-digit LRN or exact learner demographic match already exists, instantly trigger a blocking modal warning of duplicate enrollment.

## 2. Phase Logic: Official Enrollment Phase (BOSY)
When the global configuration state is set to Official Enrollment, the dashboard must function strictly as an admission intake and capacity-planning portal:

* **Top Status Sentinel:** Render the constructive institutional blue banner announcing: Academic Phase: Official Beginning of School Year (BOSY) Enrollment is Ongoing. Body text must confirm walk-in office encoding and public online enrollment verification are actively feeding the database.
* **Demographic Tally Cards:** Itemize total active headcount across Grades 7, 8, 9, and 10. Each card must display live Male vs. Female ratios (derived from the learners table sex enum) and track specific intake sub-types: Feeder Elementary Graduates, External Transferees In, and Balik-Aral.
* **Classroom Deficit Evaluator:** Compare live enrollment counts against configured homeroom seating capacities (max_capacity column in the sections table). If headcount surpasses available configured section seats, render the critical alert: Classroom Capacity Deficit Detected.
* **Visual Analytics Grid:**
    * Daily Intake Velocity (Stacked Bar Chart): X-Axis: Calendar Days (last 14 days). Y-Axis: Enrollee Count. Series: Stacked strictly by admission_channel (ONLINE vs F2F Walk-in). Rationale: Accurately displays daily encoding volume alongside intake channel distribution.
    * Intake Demographic Breakdown (Horizontal Bar Chart): Y-Axis: DepEd Intake Categories (Feeder Elementary Graduates, External Transferees In, ALS Passers, PEPT Passers, Balik-Aral). X-Axis: Headcount. Rationale: Long government category strings require horizontal rendering to maintain readability.
* **Action Gateways:** Inject interactive text links on bottom notification cards: Verify Online Enrollees →, Execute Student Sectioning →, and Review Statutory Checklists →.

## 3. Phase Logic: Classes Ongoing Phase (Late Enrollment)
When the global configuration state is set to Classes Ongoing, regular intake freezes. The dashboard pivots strictly to monitoring student movement, room balance, and statutory paper compliance:

* **Top Status Sentinel:** Render the muted slate sentinel confirming regular BOSY enrollment is closed. Public web forms remain open, but all new submissions are permanently tagged as Late Enrollees.
* **Section Load Variance Monitor:** Scan homeroom rosters. If the seating difference between the smallest and largest section within the same grade level exceeds 5 learners, render the operational alert: Section Load Disparity Requires Serpentine Rebalancing.
* **Expired Temporary Admissions Sentinel:** Track learners admitted conditionally with missing PSA Birth Certificates or SF9 Report Cards (tracked via is_temporarily_enrolled flag). If the active system clock surpasses the DepEd documentary deadline (October 31), render an actionable audit card: Expired Conditional Admissions Require Immediate Action →.
* **Visual Analytics Grid:**
    * Monthly Learner Movement Trend (Grouped Bar Chart): X-Axis: School Months (June to active month). Y-Axis: Learner Count. Grouped Bars: Transferred In (Green), Transferred Out (Amber), Dropped Out (Slate Grey). Rationale: Compares discrete monthly administrative headcounts.
    * Drop-out Reason Distribution (Horizontal Bar Chart): Y-Axis: Clerical drop_out_reason strings (Financial, Illness, Family Matters, Relocation, Bullying, Child Labor, Unknown). X-Axis: Dropped Headcount. Rationale: Aggregates student attrition data for institutional reporting.
    * Statutory Document Compliance (Donut Chart): Segments: Complete Verified Records, Missing PSA Birth Certificate, Missing SF9 Report Card. Rationale: Represents 100% mutually exclusive sets of statutory requirement compliance derived from application_checklists.

## 4. Phase Logic: EOSY Closing Phase
When the global configuration state is set to EOSY Closing, the dashboard must manage enrollment directory locking, section finality locking, and SIMS record archiving:

* **Top Status Sentinel:** Render the year-end closing banner instructing registrars to lock class rosters and verify permanent learner attributes for official School Form 1 (SF1) masterlist archiving. Public enrollment portals must be hard-locked (render badge: Web Intake Frozen).
* **Section Finality Audit Card:** Render a dedicated metric card itemizing class sections pending year-end administrative locking (derived from is_eosy_finalized boolean) with the action link: Review Unlocked Sections →.
* **SIMS Directory Consolidation Card:** Display total active, transferred, and dropped learner records consolidated across the academic year ready for historical audit logging.
* **Visual Analytics Grid:**
    * Annual Learner Retention Summary (Donut Chart): Segments: Officially Enrolled Active Tally, Cumulative Transferred Out, Cumulative Dropped Out. Rationale: Illustrates the definitive end-of-year student status breakdown for institutional headcount auditing.
    * Grade Level Roster Finalization Leaderboard (Progress Bar List): Itemizes Grades 7, 8, 9, and 10. Displays percentage filled based on locked homeroom rosters ready for active academic year termination.