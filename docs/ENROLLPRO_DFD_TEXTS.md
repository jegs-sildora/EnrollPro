# EnrollPro - Data Flow Diagram (DFD) Guide

This document outlines the logical flow of information through the EnrollPro system. It maps the conceptual data stores to physical database models and describes the core processes for learners, registrars, and administrators.

---

## 1. Data Stores to Database Mapping

The system utilizes the following data stores, which map directly to our physical Prisma ORM models:

| ID | Data Store Name | Physical Database Tables (Prisma Models) | Description |
| :--- | :--- | :--- | :--- |
| **D1** | **System Configs** | `school_settings`, `school_years`, `sections`, `teachers`, `users`, `scp_program_configs` | School year dates, class sections, teacher profiles, and admission rules for special programs (STE, SPA). |
| **D2** | **Applications** | `early_registration_applications`, `early_registration_assessments`, `learners` | Applicant demographics, basic information, and Gate 2 screening scores from Phase 1. |
| **D3** | **Enrollment Records** | `enrollment_applications`, `application_checklists`, `health_records`, `application_addresses` | Official enrollment form (BEEF) data, physical document statuses, and health/BMI data. |
| **D4** | **Placements** | `enrollment_records`, `section_advisers` | Finalized mappings of students to their assigned sections and class advisers. |

---

## 2. Level 1 DFD: Core Processes

This section details the four primary operational phases of the enrollment lifecycle.

### Process 1.0: System Setup & Rules
*   **Primary Actor:** School Administrator (Principal).
*   **Process Description:** The Administrator initializes the academic year parameters. They configure section capacities and define the grading criteria required for Special Curricular Program (SCP) admission.
*   **Inputs:** School dates, teacher lists, and program requirements.
*   **Outputs:** System settings and audit logs.
*   **Utilizes Store:** **D1 (System Configs)**.

### Process 2.0: Early Registration (Phase 1)
*   **Primary Actors:** Learner/Guardian, School Registrar.
*   **Process Description:** New learners submit online applications. The Registrar encodes verified test scores. The system cross-references these scores against D1 criteria to automatically compute rankings for SCP qualification.
*   **Inputs:** Application forms and test results.
*   **Outputs:** Application status updates (e.g., "Qualified") and SCP rank lists.
*   **Utilizes Store:** **D2 (Applications)**.

### Process 3.0: Official Enrollment (Phase 2)
*   **Primary Actors:** Learner/Guardian, School Registrar.
*   **Process Description:** Learners submit confirmation slips. The Registrar physically verifies required credentials (e.g., PSA Birth Certificate) and encodes health data. 
*   **Inputs:** Enrollment confirmations and physical documents.
*   **Outputs:** Alerts for missing documents (flagged for Temporary Enrollment).
*   **Utilizes Store:** **D3 (Enrollment Records)**.

### Process 4.0: Sectioning & Placement (Phase 3)
*   **Primary Actor:** School Registrar.
*   **Process Description:** The system's sorting engine categorizes enrolled students into classes, prioritizing SCP candidates and academic achievers before distributing the remaining learners evenly based on configured D1 capacities.
*   **Inputs:** Sorting execution trigger from the Registrar.
*   **Outputs:** Final class lists and portal visibility of section/adviser assignments.
*   **Utilizes Store:** **D4 (Placements)**.

---

## 3. Visual DFD Level 1 (3-Column Layout)

```mermaid
flowchart LR
    %% Strict orthogonal routing for academic clarity
    %%{init: {"flowchart": {"curve": "stepAfter"}}}%%

    classDef entity fill:#fff,stroke:#000,stroke-width:2px,color:#000,shape:rect
    classDef process fill:#fff,stroke:#000,stroke-width:1px,color:#000,rx:15,ry:15
    classDef datastore fill:#fff,stroke:#000,stroke-width:1px,color:#000

    %% Column 1: Entities
    A["School Administrator"]:::entity
    R["School Registrar"]:::entity
    L["Learner / Guardian"]:::entity

    %% Column 2: Processes
    P1("1.0\nSystem\nSetup"):::process
    P2("2.0\nEarly\nRegistration"):::process
    P3("3.0\nOfficial\nEnrollment"):::process
    P4("4.0\nSectioning\n& Placement"):::process

    %% Column 3: Data Stores
    D1[("D1  System Configs")]:::datastore
    D2[("D2  Applications")]:::datastore
    D3[("D3  Enrollment Records")]:::datastore
    D4[("D4  Placements")]:::datastore
    
    %% Flows: Admin
    A -->|"Setup Dates & Rules"| P1
    P1 -->|"System Logs"| A

    %% Flows: Registrar
    R -->|"Enter Test Scores"| P2
    R -->|"Verify Papers & Health"| P3
    P3 -->|"Missing Paper Alerts"| R
    R -->|"Trigger Sorting Engine"| P4
    P4 -->|"Final Class Lists"| R

    %% Flows: Learner
    L -->|"Submit Application"| P2
    P2 -->|"Status Update"| L
    L -->|"Confirm Enrollment"| P3
    P4 -->|"Show Section Info"| L
    
    %% Flows: Process to Store Mapping
    P1 <-->|"Save Settings"| D1
    P2 <-->|"Save Applications"| D2
    P3 <-->|"Save Official Record"| D3
    P4 <-->|"Save Final List"| D4

    %% Dependencies (Dashed)
    D1 -.->|"Check Rules"| P2
    D2 -.->|"Check App Status"| P3
    D3 -.->|"Get Enrolled List"| P4
    D1 -.->|"Check Section Limits"| P4