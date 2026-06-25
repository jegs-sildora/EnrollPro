# Open Questions

## Purpose

Tracks unresolved questions that affect architecture, compliance, or implementation choices.

## Summary

The main uncertainties are around role taxonomy, whether public integration feeds need stronger controls, how far the current system should go toward formal DepEd school-form generation, and how the nested SMART app should be governed.

## Detailed Analysis

- Should `REGISTRAR` become a first-class Prisma `Role`, or should it be removed from frontend compatibility paths?
- Should public `/api/integration/v1/*` feeds remain unauthenticated on production networks, or should they require scoped tokens?
- Should learner self-service use the same `authenticate` middleware long term, or a separate learner-auth payload type without `userId` assumptions?
- Should the root vault absorb the existing `EnrollPro's Second Brain/.obsidian` settings, or should that folder be removed after migration?
- Which DepEd reports are in scope for production export beyond SF1, SF4, SF5, SF6, SF8, and SF10 tracking?
- What is the intended ownership boundary between EnrollPro and `SMART/CapstoneFinal`?

## Dependencies

- [[Security Architecture]]
- [[DepEd Compliance]]
- [[School Operations]]
- [[API Architecture]]

## Risks

- Ambiguous roles and integration access can affect data privacy compliance.
- Unclear SMART ownership can lead to accidental cross-app edits.

## Recommendations

- Convert each open question into an ADR or decision-log entry when resolved.
- Prioritize role and integration-feed questions before expanding external consumers.

## Related Notes

- [[Decision Log]]
- [[Risk Register]]
- [[Integration Hub]]

