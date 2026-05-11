# EnrollPro: Panel Presentation Strategy & Chronological Demo Guide

## 🏛️ Architect's Vision
EnrollPro is not a siloed application; it is the **Single Source of Truth (SSOT)** for a school's ecosystem. This guide prepares you to demonstrate a "Masterclass in System Integration" by transitioning the school from the past into the future.

---

## 🏗️ Pre-Demo Preparation: The "Time Machine" Seeding Sequence

To show a live transition, you must seed the **entire ecosystem** in this exact order. This establishes **2025-2026** as the "Active" past and **2026-2027** as the "Upcoming" future.

### Step A: Subsystem Setup (The External World)
Before seeding EnrollPro, ensure your companion systems have data. 

**1. Seed SMART DB**
Use the prompt below to generate a seed file for the SMART grading system. This ensures SMART "knows" about the students EnrollPro will eventually query.

> **Full Prompt for SMART Seeding:**
> *"Act as a Senior Backend Developer for the SMART Grading Subsystem. I need a Node.js Prisma seed script to populate our database with mock academic results for the 2025-2026 school year. This data MUST match the EnrollPro masterlist for a successful integration demo.
> 
> **Data Requirements:**
> - **Batch Size:** 420 Learners.
> - **Primary Key (LRN):** Generate 12-digit numeric LRNs starting from `122500100001` to `122500100420` (to match the EnrollPro 2025 logic).
> - **Academic Fields:** For each learner, generate a `final_general_average` (Float, 2 decimal places) between 75.00 and 98.00.
> - **Logic:** If average >= 75.00, status is `PROMOTED`. If < 75.00, status is `RETAINED`.
> - **School Year:** Link all records to `2025-2026`.
> 
> **Technical Stack:** 
> - Use Prisma ORM.
> - Implement a `PrismaClient` transaction for speed.
> - Ensure the script is idempotent (use `upsert`).
> - The table should be queryable by LRN via a standard REST endpoint."*

**2. Seed ATLAS Registry**
Ensure the 140+ faculty members exist in the ATLAS central registry so EnrollPro can verify their licenses during the Rollover phase.

### Step B: EnrollPro Seeding (The Core)
Run these commands in the EnrollPro `server` directory:
1.  **`pnpm run db:seed`** (`seed.ts`) - Sets the timeline (2025 Active, 2026 Upcoming).
2.  **`npx tsx prisma/seed-sections.ts`** - Builds 2025 infrastructure.
3.  **`npx tsx prisma/seed-teachers.ts`** - Staffs 2025 sections via **ATLAS** sync.
4.  **`npx tsx prisma/seed-existing-learners.ts`** - Fills 2025 classrooms with 420 students.
5.  **`npx tsx prisma/seed-eosy-grades.ts`** - *Optional:* Pre-populates grades in EnrollPro (for "before sync" view).
6.  **`npx tsx prisma/seed-pending-g7.ts`** - Seeds 875 applicants for 2026-2027 Phase 1.

---

## 📅 Chronological Presentation Flow

### 1. The Exit Gate: EOSY & Promotion (Closing 2025-2026)
*   **Context:** Start with the system set to **2025-2026**.
*   **The "Moment":** Show a section (e.g., *7-Sirius*) full of students. 
*   **The SMART Connection:** Click **"Sync with SMART."**
    *   **The Technical Proof:** Explain that EnrollPro is now performing a live, cross-service GET request to the **real SMART database**. It is reading the primary source of academic truth before updating any local records.
    *   *Script:* "We are now reaching out to the external SMART grading system. Notice that EnrollPro does not store these grades yet—it reads the real SMART database first to verify the student's achievement. This live integration ensures that promotion is based on verified academic data, eliminating manual errors."
*   **Action:** Execute **EOSY Finalization**. Show students being marked as "Promoted."

### 2. The New Horizon: SY Rollover (The Bridge to 2026-2027)
*   **Context:** Transitioning to the new academic year.
*   **The Process:** 
    *   Trigger the **School Year Rollover** to 2026-2027.
    *   *Script:* "The school is now in transition. We are cloning our section structure, but because we finalized 2025, the system knows exactly how many 'Continuing' students to expect."
*   **The ATLAS Connection:** Sync with **ATLAS**. Assign Advisers for the new year.
    *   *Script:* "We now query ATLAS to verify which faculty members are licensed for 2026, ensuring our staffing is compliant for the new year."

### 3. The Public Funnel: Phase 1 (Incoming 2026-2027)
*   **Context:** January – March (Early Registration).
*   **The Process:** 
    *   Switch to 2026-2027 Dashboard. Show the **875 pending Grade 7s**.
    *   **The AIMS Connection:** Show the AIMS analysis feed.
    *   *Script:* "While we are still in the registration window, AIMS is already processing this data. It tags students from the incoming batch who may need reading intervention, so the school can prepare remediation before June."

### 4. The Official Seal: Phase 2 (Enrollment Finalization)
*   **Context:** May – June (Official Enrollment).
*   **The Process:** 
    *   Convert an Early Registrant to **Officially Enrolled**.
    *   **The Gold Standard:** Generate the **SF1 (School Form 1)**.
    *   *Script:* "Finally, we generate the SF1. Our data is now synced, verified, and formatted perfectly for the DepEd LIS system."

---

## 🔗 The Ecosystem Connectivity Map

| Subsystem | Direction | Purpose in EnrollPro |
| :--- | :--- | :--- |
| **SMART** | `Inbound` | Fetches Final Grades to determine **Promotion Eligibility**. |
| **ATLAS** | `Bi-Directional` | Syncs **Faculty Roster** for staffing and advisory assignments. |
| **AIMS** | `Outbound` | Provides **Learner Context** for early intervention and profiling. |

---

## 💡 Pro-Tips for a Successful Demo

1.  **The "Integration v1" Flex:** Mention that you built a dedicated **Integration API** so that ATLAS, SMART, and AIMS developers have a secure, read-only surface to work with.
2.  **Real-Time Sync:** If possible, have the SMART database open in another tab. Change a grade in SMART, then click "Sync" in EnrollPro to show it updating live.
3.  **Traceability:** After the Rollover, show the **Audit Logs**. It proves that "Moving a whole school to a new year" is a secure, logged event.
