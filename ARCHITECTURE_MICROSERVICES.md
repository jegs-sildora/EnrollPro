# EnrollPro Ecosystem Microservices Architecture

## Overview
EnrollPro is part of a distributed microservices system integrated via **Tailscale Tailnet**. Services communicate directly using Tailscale IP addresses and private DNS (Tailscale Funnel). EnrollPro acts as the **Single Source of Truth (SSOT)** for identity and enrollment.

## System Components

### 1. EnrollPro (Enrollment & Identity — SSOT)
- **Role:** Source of truth for student/teacher accounts and enrollment data.
- **Tailscale Host:** `dev-jegs.buru-degree.ts.net` (Local: `100.112.x.x`)
- **Data Responsibility:**
  - **Student Accounts:** LRN, name, sex, birthdate.
  - **Teacher Accounts:** Employee ID, name, email, role.
  - **Enrollment:** Grade level and Section assignment (e.g., "Grade 7 - Rizal").
- **Integration:** External systems (AIMS, ATLAS, SMART) call EnrollPro for identity and context.

### 2. AIMS (Automated Intervention & Mastery System)
- **Role:** LMS, Quiz Generation, Grading, Remediation.
- **Tailscale Host:** `100.92.245.14`
- **Data Responsibility:** Course content, quizzes, student submissions, and mastery analytics.
- **Integration:** Calls EnrollPro to verify student sections and ATLAS for teaching load assignments.

### 3. ATLAS (Scheduling & Teaching Load)
- **Role:** Master Scheduler and Faculty Loading.
- **Tailscale Host:** `100.88.55.125`
- **Data Responsibility:**
  - **Teaching Load:** Which teacher handles which section (e.g., "Teacher 1 -> Grade 7-A, English").
  - **Class Schedule:** Time and Day mapping (e.g., "8-9am, Mon/Wed/Fri").
  - **Campus Map:** Buildings and rooms.
- **Integration:** Consumed by AIMS for course assignment and SMART for class context.

### 4. SMART (Grading & Academic Records)
- **Role:** Grading system and Academic performance tracker.
- **Tailscale Host:** `100.93.66.120` (Port 5003)
- **Data Responsibility:**
  - **Grades:** Quarterly grades, initial grades, remarks.
  - **Attendance:** Section and student-level attendance tracking.
  - **Class Records:** Full historical class records.
- **Integration:** EnrollPro pulls final averages from SMART to finalize EOSY records.

## Inter-Service Communication Pattern
- **Directional Access:** Subsystems call EnrollPro directly via Tailscale IPs/DNS.
- **Auth:** Services use shared secrets or JWTs (as defined in `ENROLLPRO-API.md`, `ATLAS-PUBLIC-API.md`, and `SMART-PUBLIC-API.md`).
- **Discovery:** Use Tailnet private DNS (`.ts.net`) or static Tailscale IPs.

## Context for Agents
When working on the EnrollPro ecosystem:
1. **Never Assume Local Data:** If student section or teacher schedule is needed, check if it should be fetched from the authoritative service (EnrollPro for Identity, ATLAS for Scheduling).
2. **Consult API Docs:** Refer to specific system API references before implementing inter-service calls.
3. **Multi-Tenant Safety:** Ensure `schoolId` context is passed when calling other services to maintain isolation across the tailnet.
