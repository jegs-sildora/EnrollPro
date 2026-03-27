# PROJECT: EnrollPro
**The North Star**

**Goal:** A multi-module, school-agnostic Web-Based School Admission, Enrollment & Information Management System that replaces paper-based workflows for Philippine public secondary schools.
**Target Audience:** Public (Online Applicants), Registrars (F2F Admissions & Enrollment Management), System Admins (Configuration & Audit).

## Tech Stack
- **Frontend:** React 19, Vite 7, Tailwind CSS v4, Shadcn/UI
- **Backend:** Express.js 5.1 (Node.js 22 LTS), RESTful API
- **Database:** PostgreSQL 18, Prisma 6 ORM
- **State/Routing:** Zustand, React Router 7

## Hard Constraints
- **Zero Hardcoded School Data:** School name, logo, grade levels, and SCP programs MUST flow dynamically from the database (`SchoolSettings` and related config tables).
- **Security:** Direct URL visits to `/login` MUST be rejected; the login sequence requires Layer 1 (Frontend State Guard) and Layer 2 (Backend Pre-Flight Token).
- **Tooling:** Do NOT use Redux (use Zustand). Do NOT build custom primitives (use Shadcn/UI). Do NOT use `alert()` (use Sileo toasts).