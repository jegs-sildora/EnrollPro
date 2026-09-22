# EnrollPro ↔ ATLAS SSO — developer handoff

**To:** the EnrollPro owner/developer with access to the `dev-jegs` deployment.
**From:** ATLAS (stream `COMPANION-SSO-REVERSE-IDENTITY-C01`), 2026-09-22.
**Purpose:** one blocking configuration defect, plus two non-blocking hardening items. Everything you
need is inline — you do **not** need the ATLAS repository.

**Pins (evidence is only valid at a recorded commit):**
- EnrollPro `7b6231ee2d7a5c9801b68afd0343db2768950e42` (`D:/EnrollPro`, clean).
- ATLAS `da4d289f7e854863e1f7f74ab210d61a607b934f` (release `d4c9f391`, live).

**Status:** ATLAS → EnrollPro (reverse) is **working live**. EnrollPro → ATLAS (normal) is
**blocked** on §1.

---

## 1. BLOCKING — `ATLAS_SSO_CALLBACK_URL` points at ATLAS's result page, not its callback

### Symptom

From an authenticated EnrollPro session, opening the ATLAS handoff produced:

```
POST https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/launch   → 201
GET  https://njgrm.buru-degree.ts.net/auth/sso/callback?code=-AcXi5gh…        → 200
```

and the user landed on ATLAS's SPA result page showing *"No sign-in token was provided. Start again
from EnrollPro."* — not signed in. No ATLAS session was created.

### Root cause

EnrollPro builds the browser handoff from its own env and appends `?code=`:

- `server/src/features/auth/companion-sso.service.ts:63-69` —
  `configurationNames(system)` returns `callback: \`${system}_SSO_CALLBACK_URL\``.
- `:91-112` — `readCompanionConfiguration()` reads `process.env[names.callback]`; it requires a valid
  **https** URL and rejects one with embedded username/password or a `#fragment` (otherwise it
  returns `null` and the companion shows as *not configured*).
- `:353-354` — `const launchUrl = new URL(configuration.callbackUrl); launchUrl.searchParams.set("code", code);`

The live value is `https://njgrm.buru-degree.ts.net/auth/sso/callback`, which is ATLAS's **SPA result
page**. That page reads **only** the URL fragment `#atlasToken=…` (or a `?ssoError=…` query) — it has
no handling for a `code`, so the handoff dead-ends.

### The contract it must satisfy

ATLAS's Flow A is a **server** callback:

1. EnrollPro sends the browser to **`GET /api/v1/auth/enrollpro/callback?code=…`** on the ATLAS host.
2. The ATLAS server validates and exchanges the code server-to-server, maps it onto an existing ATLAS
   account, then `302`s to `/auth/sso/callback#atlasToken=<jwt>`.
3. The SPA consumes the fragment, strips it, and lands the user authenticated.

The two ATLAS paths differ: the **callback** is `/api/v1/auth/enrollpro/callback`; the **result page**
is `/auth/sso/callback`. The live config uses the result page where the callback belongs.

### Required change — configuration only, no code, no PR

```
ATLAS_SSO_CALLBACK_URL = https://njgrm.buru-degree.ts.net/api/v1/auth/enrollpro/callback
```

- This is an environment value on the `dev-jegs` EnrollPro deployment. **No source change is needed.**
- EnrollPro reads it from `process.env` at request time (`:227`, `:279`, `:380`) with **no module-level
  cache and no DB-backed equivalent** (the only DB access in those files is the user lookup), so the
  value must be present in the process environment — i.e. **restart EnrollPro after changing it**.
- Keep it https with no credentials and no fragment, or `readCompanionConfiguration` returns `null`
  and the ATLAS entry silently shows as unconfigured.
- The companion entry is otherwise correctly configured: `POST …/atlas/launch` returned **201**, not
  `503 COMPANION_SSO_NOT_CONFIGURED`, so `ATLAS_SSO_CLIENT_SECRET` is present, ≥ 32 characters and not
  a placeholder. Only the callback URL is wrong.

### Acceptance tests

1. **Positive.** From an authenticated EnrollPro session, the ATLAS handoff makes the browser request
   `GET /api/v1/auth/enrollpro/callback?code=…` (the ATLAS **server**), which `302`s to
   `/auth/sso/callback#atlasToken=…`, and the user lands on an authenticated ATLAS surface
   (`https://njgrm.buru-degree.ts.net`).
2. **Negative — malformed/expired code.** The result must be `/auth/sso/callback?ssoError=<typed code>`
   (e.g. `COMPANION_SSO_CODE_INVALID`), never the bare *"No sign-in token was provided."*
3. **Negative control — discriminates.** With the current (result-page) value, the flow must reproduce
   the dead end above. If both values behave the same, the test is not measuring the fix.

---

## 2. Non-blocking hardening (not required for the demo)

### 2a. Do not trust a caller-supplied numeric `userId`

`server/src/features/auth/companion-sso-reverse.service.ts:421-434` — `resolveUserById` prefers
`assertion.userId` and looks it up in EnrollPro's **own** user table, falling back to `employeeId`
only when `userId` is absent. A companion that asserts its own local account id can therefore be
signed into an **unrelated EnrollPro account** when the id spaces coincide — silently. ATLAS avoids
this by never sending `userId` (it asserts `subject` + `employeeId`), but EnrollPro should not rely on
every companion doing so.

*Ask:* prefer `employeeId`; or, if `userId` is present, require that it resolves to the same user as
the asserted `employeeId`, and reject a mismatch with a typed error.
*Acceptance:* an exchange carrying an unrelated `userId` plus a valid `employeeId` resolves to the
`employeeId` owner, or is rejected — never to the `userId` row.

### 2b. Surface the companion's error code

`server/src/features/auth/companion-sso-reverse.service.ts:383` collapses any companion HTTP 403 into
one opaque `COMPANION_REVERSE_SSO_ACCESS_DENIED`. The companion emits several distinct typed codes
(e.g. `COMPANION_SSO_ROLE_UNMAPPABLE`, `COMPANION_SSO_IDENTITY_EMPLOYEE_ID_UNAVAILABLE`), so the
cause is only findable by reading the companion's source — this cost real triage time on 2026-09-21.

*Ask:* forward the companion's `code` alongside `COMPANION_REVERSE_SSO_ACCESS_DENIED`.
*Acceptance:* a denied reverse login exposes the originating companion code.

---

## 3. What ATLAS already changed (no action for you — context only)

ATLAS's reverse assertion was failing because it required a two-token name. It now asserts:

```json
{
  "success": true,
  "issuer": "ATLAS",
  "identity": {
    "subject": "ATLAS_USER:<id>",
    "employeeId": "<employeeId>",
    "lrn": null, "middleName": null,
    "roles": ["SYSTEM_ADMIN"],
    "firstName": "…", "lastName": "…"
  },
  "activeSchoolYear": { "id": 10, "yearLabel": "2031-2032" },
  "authenticatedAt": "…"
}
```

- **No numeric `userId`** is sent (so your `employeeId` lookup is the one that resolves).
- `firstName`/`lastName` are **omitted entirely when empty** — never `""`. Your
  `companionSsoReverseExchangeResponseSchema` declares them `z.string().min(1).optional()`
  (`shared/src/schemas/companion-sso.schema.ts:62-76`), so a present-but-empty name fails validation.
- It fails closed with a typed 403 when the account has no `employeeId`.

One correction for the record: an earlier ATLAS note claimed the reverse assertion asserted a local
numeric `userId` as the cross-system id. That was a **misattribution** (the line in question is
ATLAS's own local session identity); the reverse assertion has always sent `subject`. No change is
required on your side for this.

---

## 4. After the change

Ping ATLAS and we will re-run the normal leg end to end and record the result. If it then fails
inside EnrollPro's own `employeeId` lookup (`COMPANION_REVERSE_SSO_USER_NOT_FOUND`), that is a
companion **data** matter — the EnrollPro user must carry the `employeeId` that ATLAS asserts
(currently `1234501`) — and we will report it as such rather than work around it.

**Do not** try to make this work by pointing ATLAS at the SPA path or by adding an ATLAS route at
`/auth/sso/callback`: that path is the SPA route, and the correct fix is this one configuration value.
