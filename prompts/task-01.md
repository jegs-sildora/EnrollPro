# SYSTEM DIRECTIVE: Comprehensive Full-Stack Historical Ecosystem Freezing (v97.0)

**Context Persona:** Act as a Senior GovTech Enterprise Architect. Your standard is high data-density, high-security, offline-first administrative software. Archiving a school year freezes the entire institutional ecosystem, including personnel, curriculum frameworks, geofencing, and document signatories. Strictly use plain Department of Education (DepEd) terminology. Strictly obey markdown formatting and completely avoid using any square brackets in your output.

**Core Mandate:** The system's historical view currently exhibits temporal data leakage, where current active data (signatories, configurations, and statuses) bleeds into archived dashboards. You must implement a systemic temporal lock that freezes not just the student masterlists, but the entire structural framework of the school, ensuring historical form generation, grading logic, and personnel records remain legally accurate to their specific era.

Execute the following six full-stack architectural upgrades:

## 1. Absolute Server-Side Temporal Locking
UI restrictions are easily bypassed; the database must actively defend its history.
* Implement a temporal lock at the deepest routing layer.
* Any unauthorized attempt to alter, delete, or append data to a closed school year must trigger an immediate rejection and a read-only security error.
* All UI input elements (dropdowns, toggles, text fields) must render as flat, read-only typography across all modules.

## 2. Institutional Snapshot and System Configuration
Global settings change over time; history must remember the old settings.
* When viewing an archived year, the System Configuration module must switch to a read-only snapshot.
* It must display the exact grading periods, institutional policies, and DepEd Division identifiers that were active during that specific temporal block.

## 3. Dynamic Signatories for Official DepEd Forms
Historical documents require historical signatures for legal compliance.
* Decouple the official form generation logic (SF1, SF5, SF9, SF10) from the active System Administrator configurations.
* When printing an archived form, the system must query the frozen Faculty & Staff roster to retrieve the exact School Head, Registrar, and Class Adviser assigned during that specific school year.

## 4. Curriculum and Academic Framework Preservation
Grading algorithms must remain locked to the era's DepEd mandates.
* The system must freeze the academic curriculum version (e.g., K-12 vs. MATATAG) active during the archived year.
* If grading weights, subject names, or promotion criteria change in the current active year, the historical gradebooks must strictly render using the legacy logic to prevent historical grade recalculations.

## 5. Temporal Learner States and Geofencing (Balik-Aral Isolation)
A learner's past failures or locations must not be overwritten by their future successes.
* The historical Learner Registry must lock the learner's demographic profile, geofencing coordinates, and enrollment status precisely as it was at the time of closure.
* If a learner drops out in the archived year but returns to enroll currently as Balik-Aral, the historical database must permanently reflect their status as Dropped Out for accurate year-over-year statistical reporting.

## 6. Faculty Roster Resurrection
Teachers who resigned or transferred must still exist in the archives.
* The historical Faculty & Staff masterlist must query employment date ranges.
* Ensure retired, transferred, or inactive personnel are fully restored to their ACTIVE service status and assigned advisory roles strictly within the isolated context of that historical view.