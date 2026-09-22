# Task 01 Seeded User Profiles

Source: `server/prisma/seeds/task-01-users-seed.ts`  
Scope: The four personnel accounts created or referenced by this seed only

## Purpose

This document lists every user defined by `task-01-users-seed.ts`, including
their EnrollPro role, ancillary assignments, department, login state, and
teacher profile values. It describes the seed source as written; it does not
claim that a previously modified database row will be overwritten when the seed
is run again.

## Shared Account Configuration

All four seeded personnel accounts have the following source-defined user
configuration when first created:

| Field | Seeded value |
| --- | --- |
| Application role | `TEACHER` |
| Account status | Active (`isActive: true`) |
| Initial password | `DepEd2026!` |
| Password storage | bcrypt hash with cost factor 10 |
| First-login requirement | Password change required (`mustChangePassword: true`) |
| Account identifier | Seven-digit employee ID |
| Sex | User-specific; listed below |
| Middle name | Not supplied by this seed |
| Suffix | Not supplied by this seed |
| Email | Not supplied by this seed |
| Mobile number | Not supplied by this seed |
| User-level designation | Not supplied by this seed |
| Account name | Not supplied by this seed |

`DepEd2026!` is a temporary seeded password. The account is intentionally
marked for password replacement during the first successful login.

## Shared Teacher Profile

Each account also receives a linked `Teacher` profile when that teacher does
not already exist:

| Field | Seeded value |
| --- | --- |
| Employee ID | Same as the linked user account |
| First and last name | User-specific; listed below |
| Sex | Same as the linked user account |
| Plantilla position | `TEACHER I` |
| Personnel profile designation | `CLASS ADVISER` |
| Personnel type | `TEACHING` |
| Undergraduate degree | `BACHELOR OF SECONDARY EDUCATION` |
| Postgraduate degree | `NONE` |
| Major specialization | Derived from the assigned department |
| Minor specialization | `NONE` |
| Indigenous community | `NOT_APPLICABLE` |
| Nature of appointment | `REGULAR_PERMANENT` |
| Funding source | `NATIONAL` |
| Department | User-specific; listed below |

The text designation `CLASS ADVISER` does not make the personnel member an
active class adviser by itself. For the active school year, this seed writes
`TeacherDesignation.isClassAdviser: false`, and it does not grant the
`CLASS_ADVISER` application role or assign a section.

## Seeded Users

### Juan Miguel Santos

| Profile field | Value |
| --- | --- |
| Full name | Juan Miguel Santos |
| Employee ID | `1234506` |
| Sex | Male |
| Application roles | `TEACHER` |
| Department code | `SCI` |
| Department name | `SCIENCE` |
| Major specialization | `SCIENCE` |
| Ancillary roles | `STE HEAD TEACHER`; `GRADE 7 COORDINATOR` |
| Plantilla position | `TEACHER I` |
| Personnel designation | `CLASS ADVISER` |
| Active-year class adviser flag | `false` |
| Personnel type | `TEACHING` |
| Undergraduate degree | `BACHELOR OF SECONDARY EDUCATION` |
| Postgraduate degree | `NONE` |
| Minor specialization | `NONE` |
| Appointment | `REGULAR_PERMANENT` |
| Funding source | `NATIONAL` |
| Account status | Active; first-login password change required |

### Maria Angela Reyes

| Profile field | Value |
| --- | --- |
| Full name | Maria Angela Reyes |
| Employee ID | `1234507` |
| Sex | Female |
| Application roles | `TEACHER` |
| Department code | `MAPEH` |
| Department name | `MAPEH` |
| Major specialization | `MAPEH` |
| Ancillary roles | `SPA HEAD TEACHER`; `GRADE 8 COORDINATOR` |
| Plantilla position | `TEACHER I` |
| Personnel designation | `CLASS ADVISER` |
| Active-year class adviser flag | `false` |
| Personnel type | `TEACHING` |
| Undergraduate degree | `BACHELOR OF SECONDARY EDUCATION` |
| Postgraduate degree | `NONE` |
| Minor specialization | `NONE` |
| Appointment | `REGULAR_PERMANENT` |
| Funding source | `NATIONAL` |
| Account status | Active; first-login password change required |

### Jose Gabriel Cruz

| Profile field | Value |
| --- | --- |
| Full name | Jose Gabriel Cruz |
| Employee ID | `1234508` |
| Sex | Male |
| Application roles | `TEACHER` |
| Department code | `MAPEH` |
| Department name | `MAPEH` |
| Major specialization | `MAPEH` |
| Ancillary roles | `SPS HEAD TEACHER`; `GRADE 9 COORDINATOR` |
| Plantilla position | `TEACHER I` |
| Personnel designation | `CLASS ADVISER` |
| Active-year class adviser flag | `false` |
| Personnel type | `TEACHING` |
| Undergraduate degree | `BACHELOR OF SECONDARY EDUCATION` |
| Postgraduate degree | `NONE` |
| Minor specialization | `NONE` |
| Appointment | `REGULAR_PERMANENT` |
| Funding source | `NATIONAL` |
| Account status | Active; first-login password change required |

### Anna Patricia Garcia

| Profile field | Value |
| --- | --- |
| Full name | Anna Patricia Garcia |
| Employee ID | `1234509` |
| Sex | Female |
| Application roles | `TEACHER` |
| Department code | `GEN` |
| Department name | `GENERAL EDUCATION` |
| Major specialization | `GENERAL` |
| Ancillary roles | `GRADE 10 COORDINATOR` |
| Plantilla position | `TEACHER I` |
| Personnel designation | `CLASS ADVISER` |
| Active-year class adviser flag | `false` |
| Personnel type | `TEACHING` |
| Undergraduate degree | `BACHELOR OF SECONDARY EDUCATION` |
| Postgraduate degree | `NONE` |
| Minor specialization | `NONE` |
| Appointment | `REGULAR_PERMANENT` |
| Funding source | `NATIONAL` |
| Account status | Active; first-login password change required |

## Role Interpretation

The seed uses three separate concepts that must not be treated as equivalent:

| Concept | Where stored | Meaning in this seed |
| --- | --- | --- |
| Application role | `User.roles` | Every account has only `TEACHER` |
| Personnel designation | `Teacher.designation` | Every teacher profile contains the text `CLASS ADVISER` |
| School-year assignment | `TeacherDesignation` | Ancillary roles are attached to the active school year, but `isClassAdviser` is `false` |

The four accounts therefore have teacher access and their listed coordinator or
head-teacher responsibilities. They are not assigned as section advisers by
this seed.

## Active School-Year Dependency

Before creating or updating these records, the seed reads the first
`SchoolSetting` row and requires a non-null `activeSchoolYearId`. The ancillary
roles are written to a `TeacherDesignation` for that active school year. The
seed does not contain a fixed school-year ID or year label.

If no active school year is configured, the seed stops with:

```text
No active school year found. Please run the base seed first.
```

## Department Behavior

The seed looks up each department by code. When a department is missing, it
creates it using these mappings:

| Code | Created name |
| --- | --- |
| `SCI` | `SCIENCE` |
| `MAPEH` | `MAPEH` |
| `GEN` | `GENERAL EDUCATION` |

The resulting department is connected to the teacher profile.

## Re-running The Seed

The seed uses upserts, but its update behavior is intentionally limited:

- Existing `User` rows are not updated because the user upsert has an empty
  update object.
- Existing `Teacher` rows receive the department connection and the expected
  major specialization.
- Existing active-year `TeacherDesignation` rows receive the ancillary-role
  list.
- A rerun does not reset an existing user's password, role, active status,
  first-login flag, name, or sex.
- A rerun does not set `isClassAdviser` to `false` on an already existing
  `TeacherDesignation`, because that value is supplied only during creation.

Consequently, this document describes the values produced during initial
creation. The current database may differ if an administrator or another seed
subsequently changed an existing record.
