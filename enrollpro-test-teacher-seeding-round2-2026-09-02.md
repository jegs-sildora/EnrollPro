# EnrollPro Prompt: Seed 4 Additional Test Teachers (Round 2) for ATLAS Capacity Close-Out

Date: 2026-09-02
Executor: implementation agent (EnrollPro repo — server running on the remote dev machine `100.120.169.123:5002`)
Verifier: ATLAS QA agent after this prompt
Predecessor: `D:\ATLAS\docs\prompts\enrollpro-test-teacher-seeding-2026-09-02.md` (round 1 — 8 teachers + 3 department fixes — completed and verified)

## Goal

Close the final capacity gap: ATLAS year-7 (2028-2029) generation is at 855/925 assigned (92.4%) with ~60-70 unassigned sessions per run. The residual is concentrated in four qualification pools whose real-faculty capacity is exhausted. Four more teachers deterministically close it to a publishable ≈0-unassigned run.

## Where The Gap Is (ATLAS live runs 591-594, 2026-09-02)

| Pool | Residual unassigned | Why |
|---|---|---|
| ENG/FIL | DEVL_READING ~20 sessions | 1 FIL teacher (round-1 seed) already at cap; 5 ENG teachers full |
| ESP | ~15 sessions | 4 ESP teachers ≈ 76h capacity vs 75h demand — zero grid margin; any slot collision drops sessions |
| SCI | SCI_BIO ~15 + STE (chem/phys/robotics) ~10 sessions | SCI pool at cap after the credited-load refill distributed evenly |
| MAPEH | ~5 sessions | 6 MAPEH teachers all near cap |

Run-to-run variance (60 ↔ 70 unassigned) confirms grid-margin exhaustion, not a bug.

## Teacher Records To Create

Same approach as round 1 — your standard dev seeding path, active teachers, no advisory assignment, no ancillary load, default password per your dev conventions.

| # | Name (suggest) | Employee ID | Department code | Notes |
|---|---|---|---|---|
| 1 | Corazon Ramirez | TEST-ENG-001 | ENG | English; also DEVL_READING-capable |
| 2 | Alfredo Marquez | TEST-FIL-002 | FIL | Filipino; also DEVL_READING-capable |
| 3 | Teresita Domingo | TEST-ESP-002 | ESP | Edukasyon sa Pagpapakatao |
| 4 | Roberto Alcantara | TEST-SCI-006 | SCI | Science; also SCI_BIO/STE-capable |

Department codes are load-bearing — ATLAS qualification matching is department-first, and DEVL_READING is teachable by ENG or FIL (owner's qualification mapping from round 1).

## Verification (your side)

- `GET /api/integration/v1/default/faculty` returns **39 active teachers** (35 + 4).
- The 4 new teachers show correct departments and active status.

## Handoff To ATLAS QA

After the records exist, either trigger `POST /api/integration/atlas/sync-faculty` or tell the ATLAS side — QA will then run:
faculty sync → credited-cap refill check (the 4 new teachers should absorb the residual DEVL_READING/ESP/SCI_BIO/STE pairs) → regeneration → expect ≈0 unassigned / ≈0 hard violations → publish-readiness proof.

## Constraints

- Dev-environment data only; no committed credentials or production data.
- Do not modify any existing records this round — additions only.

## Report Snippet Required

Record: how the records were created, a feed payload sample for one new teacher, the verified feed count (39), and the sync-faculty trigger result.
