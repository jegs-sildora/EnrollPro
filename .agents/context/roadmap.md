# ROADMAP

## Phase 1: Foundation & Security Infrastructure
- Initialize PERN monorepo via pnpm (React 19 + Express 5).
- Configure Database Schema (Prisma 6) with 30+ core models.
- Set up JWT Auth + 2-Layer Login Gate (FE State Guard + BE Pre-flight Token).
- Implement Global Layouts and Role-Based Access Control (RBAC).

## Phase 2: Admission Portals (Online & F2F)
- Implement Public Portal (`/apply`) with 7-step wizard and privacy consent.
- Create Registrar F2F Portal for walk-in applicants.
- Develop Tracking System with public status lookup.
- Configure SCP Pipelines (STE, SPA, SPS, etc.) with specialized logic.

## Phase 3: Enrollment & Sectioning Engine
- Build Application Inbox with multi-filter capabilities.
- Implement Two-Path Workflow (Regular vs. SCP) and Exam Result recording.
- Apply `FOR UPDATE` capacity locking for section enrollment.
- Develop Section Assignment dialogs for grade-appropriate placement.

## Phase 4: SIMS & Professional Record Management
- Build Searchable SIMS with LRN-based lookups.
- Create Tabbed Profiles for Personal, Academic, and Classification data.
- Implement Teacher Management and Advising Teacher assignments.
- Develop Enrollment History tracking across multiple Academic Years.

## Phase 5: System Administration & Communication
- Implement Dynamic Settings with logo-based accent color extraction.
- Create Academic Year Control with auto-calculated DepEd dates.
- Build Immutable Audit Trail for system-wide mutation logging.
- Develop Email Command Center with Admin logs and manual resend capability.
- Create Learner Portal with PIN-based access for enrolled students.