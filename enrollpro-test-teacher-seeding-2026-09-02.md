# EnrollPro Prompt: Seed 8 Test Teachers for ATLAS Capacity Proof

Date: 2026-09-02
Executor: implementation agent (EnrollPro repo — `D:\ATLAS\EnrollPro`,
server running on the remote dev machine `100.120.169.123:5002`)
Verifier: ATLAS QA agent after this prompt, together with the ATLAS-side
companion prompt `D:\ATLAS\docs\prompts\teaching-load-cap-enforcement-01-2026-09-02.md`
(execute the ATLAS prompt FIRST, then this one)

## Goal

Create 8 additional Teacher records in the EnrollPro dev database so ATLAS
has enough qualified faculty to cover the year-7 (2028-2029) timetable
demand and reach a clean, publishable generation run.

## Why These Departments (ATLAS capacity audit, 2026-09-02)

ATLAS's live generation run (541) has 105 unassigned sessions concentrated
in these qualification pools:

| Pool | Unmet demand | Current state | New teachers |
|---|---|---|---|
| SCI/TLE | SCI_BIO 15h + STE subjects 11h, PLUS absorbing ~230h excess currently over-assigned to 5 existing SCI/TLE teachers | 5 teachers over cap (83–113h each vs 30h standard) | **5** |
| MAPEH | SPS_SPEC 11h + MAPEH 4h + SPA_SPEC 4h | 3 teachers slightly over | **2** |
| FIL | DEVL_READING ~30h | FIL slack exists but thin (ENG side full) | **1** |

Owner's qualification mapping (ATLAS side): DEVL_READING is teachable by
ENG/FIL teachers; SPA/SPS specializations are MAPEH-qualified; STE subjects
are SCI/TLE-qualified. No separate DEVL/SPA/STE specialists are needed.

## Teacher Records To Create

Create 8 active Teacher records (personnel identity is EnrollPro-owned;
ATLAS mirrors via the faculty feed). Use your standard seeding/admin path —
whichever your repo uses for dev data (seed script, admin UI, or direct
scripted insert in a dev-only migration/scratch — your repo conventions
apply; do not commit real credentials or secrets).

| # | Name (suggest) | Employee ID | Department code | Notes |
|---|---|---|---|---|
| 1 | Ricardo Santos | TEST-SCI-001 | SCI | Science; also TLE/STE-capable |
| 2 | Marites Del Rosario | TEST-SCI-002 | SCI | Science; also TLE/STE-capable |
| 3 | Jonathan Villanueva | TEST-SCI-003 | SCI | Science; also TLE/STE-capable |
| 4 | Karen Tolentino | TEST-SCI-004 | SCI | Science; also TLE/STE-capable |
| 5 | Dennis Bautista | TEST-SCI-005 | SCI | Science; also TLE/STE-capable |
| 6 | Rowena Marcelo | TEST-MAPEH-001 | MAPEH | MAPEH incl. SPA/SPS specializations |
| 7 | Frederick Ocampo | TEST-MAPEH-002 | MAPEH | MAPEH incl. SPA/SPS specializations |
| 8 | Divina Escarez | TEST-FIL-001 | FIL | Filipino; also DEVL_READING-capable |

Field requirements (per the faculty feed contract ATLAS consumes —
`GET /api/integration/v1/default/faculty`):

- `employeeId` / `teacherId`: values above (or your numbering scheme;
  stable and unique)
- department: the codes above — ATLAS qualification matches on department
  (`departmentCode`), so SCI/MAPEH/FIL are load-bearing
- `isActive: true`, teaching-active (not teaching-exempt)
- readable `firstName`/`lastName`/`fullName`
- no advisory assignment, no ancillary load (plain teaching capacity)
- default password handling per your repo's dev conventions

## Required: Resolve The 3 No-Department Teachers

ATLAS has 3 active teachers with **no department and zero load** — verified
against the live faculty feed, the blank department is EnrollPro-side truth
(ATLAS mirrors faithfully):

| Name | Employee ID | Feed state |
|---|---|---|
| Jose Rizal | `1234501` | active, no dept, no specialization |
| Apolinario Mabini | `1234502` | active, no dept, no specialization |
| Melchora Aquino | `1234503` | active, no dept, no specialization |

In ATLAS, qualification matching is department-first, so a blank department
disqualifies a teacher from every subject — these three currently contribute
zero capacity while counting as active faculty in dashboards.

**First, check what these accounts actually are.** Their employee IDs
(`1234501`-`03`) match the dev admin-login numbering — they may be
admin/system accounts rather than real teacher records. Then apply ONE of:

- **If they are ordinary teacher records** (or can be treated as such):
  assign departments —
  - Jose Rizal → MAPEH
  - Apolinario Mabini → SCI
  - Melchora Aquino → SCI

  These are exactly the pools ATLAS is short in; with them fixed, the 8 new
  teachers become a safety margin instead of the bare minimum.

- **If they are admin/system accounts** (not meant to teach): mark them
  teaching-exempt / not-scheduling-active upstream instead, so ATLAS stops
  counting them as available faculty. Do NOT assign departments to admin
  accounts just to add capacity.

Record which option was applied per teacher and why in the report snippet.

## Verification (your side)

- `GET /api/integration/v1/default/faculty` (or the v1 faculty feed)
  returns the 8 new teachers with correct departments, active status.
- Your faculty-count surfaces (admin/teacher list) show 35 active teachers
  (27 existing + 8 new).
- The 3 no-department teachers now show either an assigned department
  (teacher-record path) or exempt/not-scheduling-active (admin-account
  path) in the feed.

## Handoff To ATLAS QA

After the records exist, trigger
`POST /api/integration/atlas/sync-faculty` (the now-working authenticated
trigger) or tell the ATLAS side to run one faculty sync. ATLAS QA will
then verify:

- ATLAS active faculty mirrors: 27 → 35
- the ATLAS rebalance + generation proof per the companion TL-01 prompt
  (expect ≈0 unassigned / ≈0 hard violations and a publishable run)

## Constraints

- Dev-environment data only; never commit credentials or production data.
- Do not modify existing teacher records beyond the optional
  idle-teacher department fix.
- No learner/personnel data beyond what is listed.

## Report Snippet Required

Record: how the records were created (seed script / UI / SQL), the final
feed payload sample for one new teacher, the verified feed count, the
no-department resolution decision per teacher (department assigned or
exempt, with the account-type finding), and the sync-faculty trigger
result.
