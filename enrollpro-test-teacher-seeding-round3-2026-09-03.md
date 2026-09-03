# EnrollPro Prompt: Seed 3 TLE Teachers (Round 3) for ATLAS Year-7 Close-Out

Date: 2026-09-03
Executor: implementation agent (EnrollPro repo — server running on the remote dev machine `100.120.169.123:5002`)
Verifier: ATLAS QA agent after this prompt
Predecessors:
- Round 1: `D:\ATLAS\docs\prompts\enrollpro-test-teacher-seeding-2026-09-02.md` (8 teachers + 3 department fixes — completed)
- Round 2: `D:\ATLAS\docs\prompts\enrollpro-test-teacher-seeding-round2-2026-09-02.md` (4 teachers — completed)

## Goal

Close the final TLE bottleneck: ATLAS's year-7 (2028-2029) timetable has 29
exploratory-TLE sections (ICT/AFA/FCS) that require
`ownerDepartment: TLE` — and the 39-teacher roster contains only **2** TLE
teachers (PAOLO CRUZ, FRANCIS NAVARRO). Even with term-scoped concurrent
load (the TL-02 constructor fix), 29 sections ÷ 2 teachers ≈ 36h/term each
— over the 30h standard. With 5 TLE teachers the per-term load drops to
~15h each, comfortably inside cap.

## The Math (ATLAS live audit, 2026-09-03)

- 3 exploratory subjects × ~10 sections × 225 min/week = ~6525 min of TLE
  demand per full rotation cycle
- Tri-mester rotation: each section's sessions cycle across 3 terms →
  concurrent per-term demand ≈ 2175 min ≈ 36h
- 2 teachers = 36h/term each (over cap) → 5 teachers = ~14.5h/term each ✓

## Teacher Records To Create

Same approach as rounds 1-2 — your standard dev seeding path, active
teachers, no advisory assignment, no ancillary load, default password per
your dev conventions.

| # | Name (suggest) | Employee ID | Department code | Notes |
|---|---|---|---|---|
| 1 | Gregorio Panganiban | TEST-TLE-001 | TLE | TLE exploratory-capable (ICT/AFA/FCS) |
| 2 | Lourdes Reyes | TEST-TLE-002 | TLE | TLE exploratory-capable (ICT/AFA/FCS) |
| 3 | Eduardo Villareal | TEST-TLE-003 | TLE | TLE exploratory-capable (ICT/AFA/FCS) |

Department code `TLE` is load-bearing — ATLAS qualification matches
`TLE_*_EXP` subjects on `ownerDepartment: TLE`. If your schema tracks
specializations, ICT/AFA/FCS-adjacent values are fine but the department is
what matters.

## Verification (your side)

- `GET /api/integration/v1/default/faculty` returns **42 active teachers**
  (39 + 3).
- The 3 new teachers show department TLE and active status.

## Handoff To ATLAS QA

After the records exist, either trigger `POST /api/integration/atlas/sync-faculty`
or tell the ATLAS side. QA will then run the TL-02 live proof chain:
faculty sync (expect 42 active) → teaching-load reset + refill →
regeneration → expect ≈0 unassigned / ≈0 hard with TLE distributed across
5 teachers → publish-readiness report.

## Constraints

- Dev-environment data only; no committed credentials or production data.
- Additions only — do not modify existing records.

## Report Snippet Required

Record: how the records were created, a feed payload sample for one new
teacher, the verified feed count (42), and the sync-faculty trigger result.
