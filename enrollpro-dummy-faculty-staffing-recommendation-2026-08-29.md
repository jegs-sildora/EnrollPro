# EnrollPro Dummy Faculty Staffing Recommendation

Date: 2026-08-29
ATLAS evidence source: Tailnet run 440, schoolId 1, schoolYearId 2
Tailnet target: https://njgrm.buru-degree.ts.net

## Executive Decision

Add 4 real dummy faculty records in EnrollPro:

| Department | Current active ATLAS faculty | Add | Target active faculty | Why |
|---|---:|---:|---:|---|
| ENG | 3 | 1 | 4 | Clears 30 Developmental Reading sessions, 22.5 hours |
| MATH | 2 | 1 | 3 | Clears 20 Mathematics sessions, 15 hours |
| ESP | 2 | 1 | 3 | Clears 20 ESP sessions, 15 hours, including 10 no-slot sessions caused by both ESP teachers being saturated or occupied |
| MAPEH | 2 real + 1 placeholder | 1 real | 3 real | Clears 20 SPS specialization sessions, 15 hours, and allows retiring or ignoring Teacher X |

Do not add a SCI or TLE teacher solely for the current Robotics blocker. In run 440, Robotics is blocked because Grade 10 Silver has no remaining section periods, not because the assigned Robotics teacher lacks weekly capacity.

## Current Live Evidence

Latest proof run:

```json
{
  "runId": 440,
  "assigned": 830,
  "unassigned": 95,
  "hardViolationCount": 95,
  "roomGradeScopeMismatches": 0
}
```

Unassigned workload by department:

| Department | Subject | Sessions | Hours | Reasons |
|---|---|---:|---:|---|
| ENG | DEVL_READING | 30 | 22.5 | FACULTY_OVERLOADED |
| MATH | MATH | 20 | 15.0 | FACULTY_OVERLOADED |
| ESP | ESP | 20 | 15.0 | 10 FACULTY_OVERLOADED, 10 NO_AVAILABLE_SLOT |
| MAPEH | SPS_SPEC | 20 | 15.0 | FACULTY_OVERLOADED |
| SCI | STE_ROBOTICS | 5 | 3.75 | NO_AVAILABLE_SLOT |

Current active faculty capacity by department:

| Department | Active faculty | Total nominal weekly capacity |
|---|---:|---:|
| ENG | 3 | 90 hours |
| MATH | 2 | 60 hours |
| ESP | 2 | 60 hours |
| MAPEH | 2 real | 60 hours |
| SCI | 3 | 90 hours |
| TLE | 2 | 60 hours |

Saturated faculty in run 440:

| Department | Saturated teachers |
|---|---|
| ENG | 3 of 3 |
| MATH | 2 of 2 |
| ESP | 2 of 2 |
| MAPEH | 2 of 2 real teachers, plus Teacher X placeholder |

## Why 4 Is the Safe Number

ATLAS uses 45-minute sessions. A full 225-minute subject requirement becomes 5 sessions per week.

The unresolved faculty-capacity workload is:

```text
ENG:   30 sessions * 45 minutes = 1350 minutes = 22.5 hours
MATH:  20 sessions * 45 minutes =  900 minutes = 15.0 hours
ESP:   20 sessions * 45 minutes =  900 minutes = 15.0 hours
MAPEH: 20 sessions * 45 minutes =  900 minutes = 15.0 hours
```

Each new dummy teacher should have `maxHoursPerWeek=30`, no ancillary load, and active scheduling status. One teacher per affected department provides enough room to absorb the unassigned workload while leaving buffer for placement flexibility.

Adding more than one teacher per listed department is not needed for this dataset and may hide assignment-quality problems by overfitting the dummy data.

## EnrollPro Dummy Data Instructions

Create exactly these new active faculty records in EnrollPro dummy data:

| Suggested employee id | Department | Suggested name | Scheduling attributes |
|---|---|---|---|
| 2000061 | ENG | Dummy ENG Reading Teacher | active, non-stale, max 30h/week, can teach Developmental Reading |
| 2000062 | MATH | Dummy Mathematics Teacher | active, non-stale, max 30h/week, can teach Mathematics |
| 2000063 | ESP | Dummy ESP GMRC Teacher | active, non-stale, max 30h/week, can teach ESP/GMRC |
| 2000064 | MAPEH | Dummy SPS MAPEH Teacher | active, non-stale, max 30h/week, can teach SPS specialization / MAPEH-owned SPS classes |

Constraints:

- Do not create placeholder teachers for this fix. These should be real dummy EnrollPro faculty records.
- Do not assign ancillary minutes to the new dummy teachers.
- Keep all four active for schoolId 1 and the 2026-2027 active school year.
- Ensure EnrollPro department values match ATLAS department codes exactly: `ENG`, `MATH`, `ESP`, `MAPEH`.
- Ensure the new teachers sync into ATLAS faculty mirrors as active and non-stale.

## ATLAS Follow-Up After EnrollPro Sync

After EnrollPro adds the records and ATLAS syncs faculty:

1. Verify active faculty counts:
   - ENG should be 4.
   - MATH should be 3.
   - ESP should be 3.
   - MAPEH should be 3 real teachers.
2. Run Teaching Load assignment repair or manually assign ownership for the unresolved subject-section pairs to the new teachers.
3. Do not count Teacher X as a final MAPEH staffing solution.
4. Trigger a fresh generation run with:
   - `schoolId=1`
   - `schoolYearId=2`
   - `roomerStrategy=HOME_ROOM_FIRST`
   - `ignoreRoomRequestGate=true`
   - `enforceShiftWindows=false`

## Verification Gate

The executor must not sign off until all of these pass:

```bash
cd atlas-server
npx tsc --noEmit
npm run build
npm run test:home-room-auto-assign
npx tsx src/__tests__/phase2-home-room-strategy.test.ts
```

Live verification must show:

```json
{
  "gradeScopeMismatches": 0,
  "sectionsWithHomeRoom": "20/20",
  "ENG": { "activeFaculty": 4 },
  "MATH": { "activeFaculty": 3 },
  "ESP": { "activeFaculty": 3 },
  "MAPEH": { "realActiveFaculty": 3 }
}
```

Generation signoff target:

- `FACULTY_OVERLOADED` unassigned sessions should drop materially for ENG, MATH, ESP, and MAPEH.
- ESP `NO_AVAILABLE_SLOT` should drop after ownership is redistributed to the new ESP teacher.
- `roomGradeScopeMismatches` must remain 0.
- If STE Robotics remains unassigned for Grade 10 Silver, classify it separately as section timetable saturation, not a faculty staffing failure.

## Robotics Caveat

Run 440 shows Grade 10 Silver already occupies every canonical weekly section slot. The Robotics teacher has spare generated load, so adding a Robotics teacher alone will not create a place for the class.

Handle Robotics in a separate scheduling repair pass:

- reduce or term-scope Grade 10 Silver demand,
- move a lower-priority Grade 10 Silver class out of the canonical window,
- or add an explicit extended/alternate slot policy for the Robotics class.

## Summary for EnrollPro Dev

Please add 4 active dummy faculty records for ATLAS scheduling validation:

```text
ENG +1
MATH +1
ESP +1
MAPEH +1
```

Expected final department counts in ATLAS after sync:

```text
ENG = 4
MATH = 3
ESP = 3
MAPEH = 3 real active teachers
SCI = unchanged at 3
TLE = unchanged at 2
```

This is the minimum safe dummy-data staffing increase to alleviate the current run 440 faculty-capacity blockers without masking the separate Grade 10 Silver Robotics slot-saturation issue.
