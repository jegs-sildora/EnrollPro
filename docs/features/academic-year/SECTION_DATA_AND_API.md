# Section Data and Backend API Documentation

This document provides a comprehensive overview of the `Section` table structure and the associated backend APIs in EnrollPro. EnrollPro serves as the Single Source of Truth (SSOT) for section assignments within the microservices ecosystem.

## 1. Database Schema (Prisma)

The `Section` model represents a class section for a specific grade level and school year.

### Model: `Section`
| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int` | Primary Key (autoincrement) |
| `name` | `String` | Name of the section (e.g., "Rizal", "Aguinaldo") |
| `maxCapacity` | `Int` | Maximum number of learners (Default: 40) |
| `gradeLevelId` | `Int` | Foreign Key to `GradeLevel` |
| `schoolYearId` | `Int` | Foreign Key to `SchoolYear` |
| `programType` | `ApplicantType` | Type of program (e.g., REGULAR, STE, SPA) |
| `isEosyFinalized` | `Boolean` | Flag indicating if End-of-School-Year processing is complete |
| `sortOrder` | `Int` | Order of display (Default: 9999) |
| `isHomogeneous` | `Boolean` | Flag for homogeneous grouping |
| `isSnake` | `Boolean` | Flag for snake-style sectioning algorithm |
| `tleProgramId` | `Int?` | Optional TLE specialization (for Grades 9/10) |
| `scpProgramConfigId` | `Int?` | Optional SCP configuration link |
| `sectionRank` | `Int?` | Numeric rank within the grade level |
| `createdAt` | `DateTime` | Timestamp of creation |
| `updatedAt` | `DateTime` | Timestamp of last update |

### Relations
- `gradeLevel`: The `GradeLevel` this section belongs to.
- `schoolYear`: The `SchoolYear` this section is active in.
- `advisers`: Historical record of `SectionAdviser` assignments.
- `enrollmentRecords`: List of learners officially enrolled in this section.
- `tleProgram`: Linked TLE specialization.
- `teacherDesignations`: Teacher assignments for this section.

---

## 2. Backend API (Internal)

Internal routes used by the EnrollPro client. These routes require authentication and authorization.

**Base Path:** `/api/sections`

### Section Management
- `GET /`: List all sections for the active school year.
- `GET /:ayId`: List all sections for a specific school year ID.
- `POST /`: Create a new section. (Head Registrar/Admin)
- `PUT /:id`: Update section details. (Head Registrar/Admin)
- `DELETE /:id`: Delete a section. (Head Registrar/Admin)

### Sectioning & Roster
- `GET /:id/roster`: Get the list of learners enrolled in a specific section.
- `GET /unsectioned-pool/:gradeLevelId`: Get learners eligible for sectioning but not yet assigned.
- `POST /:id/inline-slot`: Manually assign a single learner to a section.
- `POST /transfer-learner`: Move a learner from one section to another.

### Batch Sectioning (Algorithm)
- `GET /batch-sectioning/prerequisites/:gradeLevelId`: Check if prerequisites are met for automated sectioning.
- `POST /batch-sectioning/run`: Run the sectioning engine preview without committing.
- `POST /batch-sectioning/commit`: Persist the generated sectioning assignments.

### Teacher/Adviser Operations
- `GET /teachers`: List teachers eligible to be class advisers.
- `POST /:id/handover-adviser`: Transfer advisory responsibility from one teacher to another.

---

## 3. Microservices Integration API (Public)

Exposed for downstream services like **ATLAS** and **AIMS** via the Tailscale network.

**Base Path:** `/api/integration/v1`

- `GET /sections`: Returns a list of all active sections with their metadata.
- `GET /sections/:sectionId/learners`: Returns the roster of learners for a specific section (LRN, names, etc.).

---

## 4. Shared Schemas (Zod)

Located in `shared/src/schemas/section.schema.ts`.

### `createSectionSchema`
Used for creating and updating sections.
```typescript
{
  name: string,
  sortOrder?: number,
  gradeLevelId: number,
  schoolYearId: number,
  programType: "REGULAR" | "STE" | "SPA" | ...,
  isHomogeneous: boolean,
  isSnake: boolean,
  tleProgramId?: number | null,
  advisingTeacherId?: number | null,
  maxCapacity: number
}
```

### `batchSectioningSchema`
Used for running and committing automated sectioning.
```typescript
{
  gradeLevelId: number,
  schoolYearId: number,
  params?: {
    steQuota: number,
    steSections: number,
    pilotSectionCount: number,
    sectionCapacity: number
  },
  assignments?: Array<{ applicationId: number, sectionId: number }>
}
```
