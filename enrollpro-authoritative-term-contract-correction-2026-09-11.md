# EnrollPro authoritative term contract — correction handoff

## Review boundary

- Repository: `https://github.com/njgrm/EnrollPro`
- EnrollPro remains `READ_ONLY` to ATLAS agents.
- Reviewed base: `3e282e2b86e7c88604a7ad0ebc1996e7409f720e`
- Reviewed candidate: `396a9892c0124d5e85e0586a23ab953efa24c496`
- Candidate commit: `feat: implement school year rollover service and integration schemas with documentation`
- Verdict: `CORRECTION_REQUIRED`

The core design is accepted: EnrollPro owns `TRIMESTER`/`QUARTERS`, stable
`T1`–`T4` identities, stored display labels, ordered inclusive dates, and
active-term resolution. The migration is additive and the integration routes
are mounted behind the existing integration-key middleware. Do not redesign
that contract.

## Material finding EP-TERM-01 — malformed year IDs are coerced

Evidence:

- `server/src/features/integration/integration.shared.ts:64-75`
- `resolveSchoolYearScope()` uses this parser for the optional
  `schoolYearId` query parameter at `integration.shared.ts:108-114`.

`parsePositiveInt()` uses `Number.parseInt(String(value), 10)`. Inputs such as
`3.5`, `3abc`, and duplicate query arrays can therefore select a real year
instead of returning the documented typed `400 SCHOOL_YEAR_ID_INVALID`.

Required correction:

- Accept exactly one canonical positive base-10 integer value.
- Reject fractions, suffixes, signs producing non-positive values, scientific
  notation, infinities, whitespace-only values, and duplicate query values.
- Preserve the omitted-parameter behavior that resolves the authoritative
  active year.

Acceptance tests through the mounted integration route:

1. `schoolYearId=3.5`, `3abc`, `1e2`, `0`, `-1`, blank, and duplicate values
   return `400 SCHOOL_YEAR_ID_INVALID`.
2. A canonical positive integer selects that exact current or historical row.
3. Omission still selects the sole authoritative active year.
4. Every rejected input performs zero school-year mutation and zero audit
   write.

## Material finding EP-TERM-02 — mutation can persist a contract that reads as invalid

Evidence:

- `shared/src/schemas/integration-term.schema.ts:4-9` accepts whitespace-only
  labels because it uses `z.string().min(1)` without trimmed validation.
- `shared/src/schemas/school-year.schema.ts:5-25` type-checks individual term
  fields but does not validate the merged complete contract.
- `server/src/features/school-year/controllers/school-year.admin.controller.ts:401-450`
  writes partial term dates, format, and labels directly.
- `server/src/features/school-year/services/term-contract.service.ts:93-153`
  correctly rejects missing, blank, reversed, overlapping, or out-of-order
  entries—but only later when a consumer reads the integration endpoint.

An administrator can save a whitespace label, overlap two terms, remove a
required date, or change `TRIMESTER` to `QUARTERS` without complete T4 dates.
The write succeeds and the authoritative `/integration/v1/school-year` route
then returns a typed 409. This turns ordinary configuration into an avoidable
downstream outage.

Required correction:

- On create and on any update touching term format, labels, or dates, merge the
  proposed partial input with the persisted row.
- Validate the complete merged contract with the same production
  `buildOrderedTermContract()` authority before the database write.
- Normalize or reject whitespace-only labels; do not store a value the
  integration service will reject.
- Return a stable typed 4xx error with the existing term-contract code and no
  write when validation fails.
- Preserve unrelated school-year updates and valid partial term updates.

Acceptance tests through the mounted privileged school-year route:

1. Missing required date, reversed range, overlap, out-of-order dates,
   whitespace-only label, and QUARTERS-without-T4 all fail before mutation.
2. The school-year row, `updatedAt`, active pointer, and audit count remain
   unchanged after each rejected request.
3. A valid partial label/date edit succeeds and immediately produces a valid
   `/api/integration/v1/school-year` response.
4. Changing format without explicit labels regenerates canonical labels;
   explicit valid labels are preserved exactly according to the documented
   normalization rule.
5. Rollover still copies the complete validated source labels and dates.

## Packaging corrections

- Remove the generated `server/tsconfig.tsbuildinfo` delta from the correction
  candidate unless EnrollPro intentionally tracks deterministic build output.
- Fix the trailing whitespace reported by `git diff --check` in
  `docs/features/integration/ATLAS-AUTHORITATIVE-TERM-CONTRACT-HANDOFF-2026-09-11.md`.
- Update the handoff's stale `EnrollPro commit SHA: not created yet` field to
  the new correction candidate SHA after committing.

## Required executor return

The EnrollPro developer shall add one correction commit on top of `396a9892`,
push it to the fork, and return:

1. base and full candidate SHAs;
2. exact changed paths;
3. mounted-route failing-first and passing counts;
4. strict-ID rejection matrix;
5. invalid-update zero-write matrix;
6. focused term service, schema, server type-check/build, and `git diff --check`;
7. confirmation that the EnrollPro migration, rollover, and live data were not
   applied or mutated.

ATLAS consumption, EnrollPro migration/deployment, timetable generation, and
publication remain unauthorized by this handoff.
