# Directory Audit

## Purpose

Structural inventory of the repository.

## Summary

The repository contains the main EnrollPro pnpm workspace, documentation, diagrams, prompts, local agent configuration, and a separate nested SMART app.

## Detailed Analysis

Top-level areas:

- `client`: main React frontend.
- `server`: main Express/Prisma backend.
- `shared`: workspace package for shared schemas/types/constants.
- `docs`: implementation, process, database, API, and feature documentation.
- `diagrams`: DFD/use-case/source diagrams.
- `prompts`: task prompts for agents.
- `SMART/CapstoneFinal`: separate grading companion app.
- `.agents`, `.codex`, `.claude`, `.gemini`: local agent/tooling configuration.
- `EnrollPro's Second Brain`: existing Obsidian configuration folder, not the canonical vault notes created by this task.

## Dependencies

- [[Components]]
- [[Routes]]
- [[Services]]
- [[Utilities]]

## Risks

- Nested app and generated artifacts increase accidental edit scope.
- Agent configuration folders should not be treated as product code.

## Recommendations

- Keep task changes scoped to the main workspace unless SMART is explicitly requested.
- Add `.gitignore` coverage for generated outputs if missing.
- Continue using root-level vault folders for project memory.

## Related Notes

- [[System Understanding]]
- [[Dependencies]]

