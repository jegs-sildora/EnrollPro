# EnrollPro developer handoff — companion SSO configuration (ATLAS ↔ EnrollPro)

Status: authored 2026-09-17 (Asia/Manila) by the ATLAS head planner. **This document describes work that
must be performed in the EnrollPro repository by the EnrollPro team. ATLAS must not edit EnrollPro source,
configuration, migrations, lockfiles, or Git history.** It is a developer-facing handoff, not an ATLAS
change.

## 1. Why this is needed

ATLAS implements the full ATLAS side of the companion SSO contract (Flow A callback/exchange with a local
session; Flow B reverse authorize/exchange with hash-only one-time codes; strict validation; the
Integrated Systems AppShell area). That work is integrated and **already deployed**:

- `c989f03d` (the COMPANION-SSO-C01 implementation) is an ancestor of the live ATLAS release `54dce67b`.
- The routes are mounted on ATLAS and reachable on the shared Tailnet host:
  `POST /api/v1/auth/sso/authorize` and `POST /api/v1/auth/sso/exchange` both return **401** (mounted,
  authentication required) rather than 404, verified read-only on 2026-09-17.

Two things are **not** in place, and both are outside ATLAS's authority to do:

1. ATLAS's own durable environment has **no `SSO`/`COMPANION` key configured**, so the ATLAS service fails
   closed with `COMPANION_SSO_NOT_CONFIGURED`. That is an ATLAS HIGH environment action being folded into
   the pending ATLAS deployment, using the paired values below.
2. **EnrollPro must be configured to accept ATLAS-issued codes and to issue its own** — this document.

## 2. The shared secret (paired)

| Key | Where | Requirement |
|---|---|---|
| `ENROLLPRO_SSO_CLIENT_SECRET` | **both** sides | a single high-entropy secret, **>= 32 characters**, byte-identical on ATLAS and EnrollPro. ATLAS sends it as `Authorization: Bearer ${ENROLLPRO_SSO_CLIENT_SECRET}` on outbound exchange calls. |

Provision it out of band (e.g. a password manager or a direct secure channel). **Do not** transmit it
inside an issue, pull request, commit, log, screenshot, or chat transcript. Neither side may print it.

ATLAS-side companion values set with the same change:

- `ENROLLPRO_SSO_CALLBACK_URL` — EnrollPro's **exact** reverse callback URL (see §4). ATLAS binds the
  redirect to this string; a mismatch must fail closed.
- `ENROLLPRO_BASE_URL` — EnrollPro's base URL used by ATLAS for outbound calls (if not already implied by
  the existing `ENROLLPRO_API`).

## 3. Flow A — EnrollPro → ATLAS (ATLAS is the relying party)

1. The user starts from EnrollPro and is redirected to ATLAS's authorize/callback entry.
2. ATLAS verifies the EnrollPro identity, resolves the local ATLAS account, applies the role-intersection
   rule, and establishes a **local ATLAS session**. It does not proxy or reuse an EnrollPro session token.
3. Typed failure codes ATLAS already emits and EnrollPro should surface faithfully rather than retrying
   blindly: `COMPANION_SSO_NOT_CONFIGURED`, `COMPANION_SSO_UNREACHABLE`, `COMPANION_SSO_CLIENT_INVALID`,
   `COMPANION_SSO_CODE_INVALID`, `COMPANION_SSO_IDENTITY_INCOMPLETE`,
   `COMPANION_SSO_ACCOUNT_UNAVAILABLE`, `COMPANION_SSO_ROLE_DENIED`.

## 4. Flow B — ATLAS → EnrollPro (EnrollPro is the relying party)

1. The user starts in ATLAS; ATLAS requests a **one-time authorization code** from EnrollPro.
2. ATLAS receives the code and redirects the browser to EnrollPro's reverse callback.
3. EnrollPro **exchanges the code** for an EnrollPro session, consuming the code **atomically and exactly
   once**; a replayed or expired code must fail closed with a typed error.

**Required EnrollPro-side configuration:**

| Item | Requirement |
|---|---|
| Registered redirect/callback URI | the exact `${ENROLLPRO_PUBLIC_URL}/api/auth/companion-sso/atlas/reverse/...` path ATLAS binds to; no wildcard, no trailing-slash ambiguity |
| Inbound authentication | accept and verify `Authorization: Bearer ${ENROLLPRO_SSO_CLIENT_SECRET}` on the code-exchange endpoint |
| One-time code | hash-only storage, single atomic consume, short TTL, replay rejected |
| Public URL | `ENROLLPRO_PUBLIC_URL` must be the Tailnet/public origin actually used by the browser, so the registered URI matches what ATLAS sends |
| Error shape | return typed, non-leaking errors; never echo the presented code or the secret |

## 5. Roles and scope

ATLAS enforces its own role-intersection rule on its side. EnrollPro should state which of its roles are
entitled to reach ATLAS so the intersection is intentional rather than accidental. The former
allowed-role gap was found and corrected during ATLAS review (`fbb9dc63`); confirm EnrollPro's expectation
matches.

## 6. Acceptance tests to run jointly

1. **Flow A happy path** — start in EnrollPro, land in ATLAS authenticated, with an ATLAS-local session
   only (no EnrollPro token in ATLAS storage).
2. **Flow B happy path** — start in ATLAS, land in EnrollPro authenticated.
3. **Replay** — present the same one-time code twice: the second attempt fails with a typed error and
   creates no second session.
4. **Expiry** — present a code after its TTL: typed failure, no session.
5. **Wrong secret** — bearer with a mutated secret: typed failure, no session, no code consumed.
6. **Wrong/mismatched redirect** — a callback that does not match the registered URI: fail closed.
7. **Unauthorized role** — an EnrollPro identity whose role is outside the intersection: typed denial, no
   ATLAS session.
8. **Unreachable counterpart** — stop one side and confirm a bounded typed failure, not a hang, with no
   partial session created.
9. **Log hygiene** — grep both sides' logs for the secret, the code, and the bearer header; all must be
   absent.

## 7. ATLAS-side prerequisites and sequencing (for planning the joint test)

| # | Prerequisite | Owner |
|---|---|---|
| 1 | `0002_companion_sso_code` migration applied (the `companion_sso_codes` table does not exist yet; SSO cannot store or consume codes without it) | ATLAS — `MIG-APPLY-0002-0003` |
| 2 | Deployment carrying the later SSO corrections (`COMPANION-SSO-C03` `fc7abe07`, `COMPANION-SSO-LIVE-PREP-C02` `d16ee390`, neither currently deployed) | ATLAS — `CONSOLIDATED-DEPLOYMENT-C10` |
| 3 | The companion-SSO environment keys of §2 set in ATLAS's durable env | ATLAS — folded into the deployment, requires the paired values from you |
| 4 | The EnrollPro configuration of §3–§5 | **EnrollPro** |
| 5 | The joint acceptance tests of §6 | both |

Until 1–4 are complete, ATLAS will fail closed — that is intended, not a defect.

## 8. What ATLAS is NOT asking for

- No change to EnrollPro's data model or migrations is proposed by ATLAS.
- No shared database. ATLAS remains an isolated microservice; SSO is an HTTP contract only.
- No ATLAS code change is required for the items in this document.
