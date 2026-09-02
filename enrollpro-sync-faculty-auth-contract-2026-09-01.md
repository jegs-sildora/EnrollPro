# EnrollPro Prompt: ATLAS Faculty-Sync Trigger Auth Contract

Date: 2026-09-01
Executor: implementation agent (EnrollPro repo — `D:\ATLAS\EnrollPro`)
Verifier: ATLAS QA agent after this prompt, together with the ATLAS-side
companion prompt `D:\ATLAS\docs\prompts\rollover-sync-faculty-auth-contract-10-2026-09-01.md`

## Goal

Make `POST /api/integration/atlas/sync-faculty` authenticate its call to
ATLAS with the documented shared server key, instead of calling ATLAS's
authenticated endpoint with no credentials (which ATLAS correctly rejects
with 401 today).

## Verified Current State (2026-09-01, ATLAS repo context)

- `server/src/features/integration/integration-trigger.controller.ts`
  lines ~89-95: `syncAtlasFaculty` calls
  `axios.post(\`${baseUrl}/api/v1/faculty/sync\`, { mode: 'reconcile' },
  { timeout: 15000 })` — no headers, with an in-code comment
  "Direct trigger without API key headers".
- ATLAS guards `/api/v1/faculty/sync` with
  `authenticateWithSystemToken` (Bearer system token or privileged JWT) +
  privileged-role check. Unauthenticated calls get 401.
- EnrollPro's own `docs/features/integration/ATLAS_API_GUIDE.md` documents
  `ATLAS_API_KEY=server-secret` as the EnrollPro→ATLAS credential.
- `server/src/features/sf7/sf7.service.ts` already implements the pattern
  correctly: `atlasHeaders()` (line ~686) sends
  `Authorization: Bearer <key>` + `X-Integration-Key: <key>` using
  `ATLAS_API_KEY`, optional-if-unset.
- `ATLAS_API_KEY` is currently NOT configured in `server/.env`.

## Fix Requirements

1. **Extract a shared helper or reuse the pattern**: move/duplicate the SF7
   `atlasHeaders()` logic somewhere reusable for integration triggers (e.g.
   `server/src/lib/` following your repo's conventions) — one definition of
   "headers we send to ATLAS".
2. **Wire it into `syncAtlasFaculty`**: the `axios.post` to
   `${baseUrl}/api/v1/faculty/sync` must include those headers. Remove the
   "Direct trigger without API key headers" comment. Keep the 15s timeout.
3. **Fail with an actionable error when the key is unset**: if
   `ATLAS_API_KEY` is not configured, the trigger should return a clear 500
   (or your repo's equivalent AppError shape) saying the integration key
   must be configured in `server/.env` — NOT a generic 503 handshake error
   from ATLAS's 401. Distinguish "ATLAS unreachable" (network) from
   "ATLAS rejected our credentials" (401/403 → surface the distinction in
   the audit log description and the API message).
4. **Env documentation**: add `ATLAS_API_KEY` to
   `server/.env.example` (not `.env` in git) with a comment explaining it
   must equal ATLAS's `ATLAS_SYSTEM_TOKEN`. Set the actual value in the
   local `server/.env` to the value ATLAS's side configured (coordinate
   with the ATLAS-side prompt; both must match).
5. **Audit log**: the existing `ATLAS_FACULTY_SYNC` audit entry should
   record whether auth was used (never log the key value itself).
6. **Docs**: update `docs/features/integration/ATLAS_API_GUIDE.md` if the
   trigger's behavior description needs the auth note (it already documents
   the key — just ensure the sync-faculty row's reality matches).

## Constraints (from your repo conventions)

- No `.env` files committed; `.env.example` updates only.
- Keep the controller thin; the header helper belongs in `lib/` or an
  existing shared location.
- Do not log the `ATLAS_API_KEY` value.
- Verify with `pnpm --filter server build` and a manual smoke of the
  trigger against the ATLAS Tailnet URL once the key is set on both sides.

## Acceptance Criteria

- With the key configured on both sides: `POST /api/integration/atlas/sync-faculty`
  returns success and ATLAS's faculty sync actually runs (check ATLAS's
  `FACULTY_SYNC_COMPLETED` notification/audit or the returned
  `activeCount`).
- Without the key on the EnrollPro side: the trigger fails with the
  actionable "key not configured" error, not a network-style 503.
- With a wrong key: the trigger surfaces ATLAS's 401 as an auth failure
  distinct from unreachable.
- No secrets in code or logs.

## Report Snippet Required

Record: files changed; where the header helper lives; the error
classification behavior; env setup performed; the smoke-test result against
ATLAS (success + auth-failure cases); build output.
