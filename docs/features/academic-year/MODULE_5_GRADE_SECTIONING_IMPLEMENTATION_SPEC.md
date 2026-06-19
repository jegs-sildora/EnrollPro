# Module 5 Implementation Spec: Grade Level and Sectioning Management

Last updated: 2026-04-14

## 1. Module intent

Manage per-school-year grade levels, sections, capacities, List of Classes, and SCP configuration schedules used by admission pipelines.

## 2. Current implemented backend surface

School year and date governance:

- [server/src/features/school-year/school-year.router.ts](../../../server/src/features/school-year/school-year.router.ts)
- [server/src/features/school-year/school-year.controller.ts](../../../server/src/features/school-year/school-year.controller.ts)

Curriculum and SCP config:

- [server/src/features/curriculum/curriculum.router.ts](../../../server/src/features/curriculum/curriculum.router.ts)
- [server/src/features/curriculum/curriculum.controller.ts](../../../server/src/features/curriculum/curriculum.controller.ts)

Sections and adviser assignment:

- [server/src/features/sections/sections.router.ts](../../../server/src/features/sections/sections.router.ts)
- [server/src/features/sections/sections.controller.ts](../../../server/src/features/sections/sections.controller.ts)

Frontend:

- [client/src/features/sections/pages/Index.tsx](../../../client/src/features/sections/pages/Index.tsx)
- [client/src/features/settings/pages/SchoolYearTab.tsx](../../../client/src/features/settings/pages/SchoolYearTab.tsx)
- [client/src/features/settings/pages/CurriculumTab.tsx](../../../client/src/features/settings/pages/CurriculumTab.tsx)
- [client/src/features/settings/pages/EnrollmentGateTab.tsx](../../../client/src/features/settings/pages/EnrollmentGateTab.tsx)

## 3. User stories

### 3.1 School-year setup stories

1. As a system admin, I can activate a new school year and clone baseline structures.
2. As a system admin, I can configure enrollment gate windows and override open/close behavior.

### 3.2 Grade and section stories

1. As registrar/admin, I can create and manage sections per grade level with max capacity.
2. As registrar/admin, I can assign advising teachers to sections.
3. As registrar/admin, I can view section fill rates for operational planning.

### 3.3 SCP configuration stories

1. As system admin, I can configure offered SCP programs and pipeline schedules by school year.
2. As registrar/admin, I can read SCP program configuration for active school year.

## 4. Acceptance criteria (current implementation)

1. School-year activate flow sets ACTIVE status and updates SchoolSetting.activeSchoolYearId.
2. School-year date updates and override toggles are auditable.
3. Section create/update/delete enforces basic capacity and enrollment safety checks.
4. Grade-level and section data is school-year scoped.
5. SCP config updates persist steps and options per school year.
6. Section capacity heatmap is available in frontend sections page.

## 5. Edge cases

1. Cannot delete school year with applicants/enrollments.
2. Cannot delete section with enrolled students.
3. Invalid school-year date windows should be blocked by validation and UX constraints.
4. Clone operations should not duplicate into inconsistent grade-level states.
5. Adviser deactivation should keep section references intact and visible.

## 6. API contract baseline (REST)

School year:

- GET /api/school-years
- GET /api/school-years/next-defaults
- GET /api/school-years/:id
- POST /api/school-years/activate
- PUT /api/school-years/:id
- PATCH /api/school-years/:id/status
- PATCH /api/school-years/:id/override
- PATCH /api/school-years/:id/dates
- DELETE /api/school-years/:id

Curriculum and SCP:

- GET /api/curriculum/:ayId/grade-levels
- POST /api/curriculum/:ayId/grade-levels
- PUT /api/curriculum/grade-levels/:id
- DELETE /api/curriculum/grade-levels/:id
- GET /api/curriculum/:ayId/scp-config
- PUT /api/curriculum/:ayId/scp-config

Sections:

- GET /api/sections/:ayId
- GET /api/sections/teachers
- POST /api/sections
- PUT /api/sections/:id
- DELETE /api/sections/:id

## 7. Best UX/UI approach for Module 5

Design direction: school-year command cockpit with registrar-ready operational views.

1. School-year setup wizard:
   - date-driven defaults,
   - clone options explained in plain language,
   - diff preview for copied structures.
2. Capacity-first section board:
   - heatmap plus editable cards,
   - quick adviser assignment and availability indicators.
3. Enrollment gate timeline:
   - one visual timeline with override state at top,
   - immediate phase feedback (EARLY_REGISTRATION, REGULAR_ENROLLMENT, CLOSED, OVERRIDE).
4. SCP configuration panel:
   - offered toggle per program,
   - readonly baseline steps + editable schedule fields,
   - validation badges for incomplete schedule entries.
5. Low-infrastructure operation:
   - keep core actions on lightweight forms,
   - avoid heavy charts where a compact table is clearer and faster.

## 8. Refactor targets for Module 5

1. Introduce SectionPlacementService for future autonomous placement logic.
2. Add bulk section operations (capacity updates, adviser reassignment) with audit bundles.
3. Add deterministic validation service for cross-window date consistency.
4. Add snapshot export endpoint for school-year configuration review and approval workflows.
