ATLAS → EnrollPro: Flow B fix is a one-value change

Good news: no code change needed on either side. Your /reverse/start already sets
response_type=code, client_id, redirect_uri and state — exactly what ATLAS validates.
The only problem is its redirect target.

ATLAS's /api/v1/auth/sso/authorize is a POST-only, JWT-authenticated API route; a
browser GET cannot reach it (404, confirmed). ATLAS ships a browser-facing SPA
mediator at /auth/enrollpro/authorize that IS already live, accepts your four params
on the query string, authenticates the ATLAS user, calls the POST route, and
navigates the browser to the returned callbackUrl.

CHANGE THIS ONE VALUE:
  ATLAS_SSO_REVERSE_AUTHORIZE_URL="https://njgrm.buru-degree.ts.net/auth/enrollpro/authorize"
KEEP:
  ATLAS_SSO_REVERSE_EXCHANGE_URL="https://njgrm.buru-degree.ts.net/api/v1/auth/sso/exchange"
Both must stay on the same origin (your own check) — they do.

Your /reverse/start must still run first (it sets the state cookie your
/reverse/callback requires); the mediator is reached after it. Then:

  browser -> /api/auth/companion-sso/atlas/reverse/start  (sets state cookie)
          -> 303 to the ATLAS mediator with your 4 params
          -> ATLAS authenticates, mints a one-time code, navigates to your
             redirect_uri (?code&state)
          -> your /reverse/callback calls ATLAS POST /api/v1/auth/sso/exchange
             with Bearer ATLAS_SSO_REVERSE_CLIENT_SECRET and {code}

The redirect_uri you send must byte-match our registered value:
  https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/reverse/callback
We compare it strictly.

Still needed from you:
 1. The VALUE of the regenerated ATLAS_SSO_REVERSE_CLIENT_SECRET (your doc only has
    a placeholder). Send it out of band, never in a doc/issue/commit.
 2. Confirm the reverse callback URL above.
 3. Resolve the active school year: your exchange aborts at
    companion-sso.service.ts:489-500 (INVALID/UNINITIALIZED ->
    ACTIVE_SCHOOL_YEAR_REQUIRED) before ATLAS's validator runs. With the host date
    in 2026 and the year at 2030-2031 this is our most likely joint-test blocker.

Thanks for the F1/F2 fixes and the secret rotation in 7b6231ee — those are confirmed.