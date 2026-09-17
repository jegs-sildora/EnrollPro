isa pa <@759970543532638238> 
ATLAS → EnrollPro: companion SSO configuration

Thanks for the SSO implementation + integration guide. We read it read-only at
jegs-sildora/EnrollPro main = 2881152e (your push landed on upstream, not on our fork
njgrm/EnrollPro, which is still 5887d685 — ATLAS can't push to your repo, so if you want
it on the fork, fast-forward njgrm/EnrollPro from upstream).

Answer to your blocking route question: the /api/v1 pair is canonical.
  Flow A code entry   GET  https://njgrm.buru-degree.ts.net/api/v1/auth/enrollpro/callback?code=...
  Flow A result page      https://njgrm.buru-degree.ts.net/auth/sso/callback   <- your
                          ATLAS_SSO_CALLBACK_URL is ALREADY CORRECT
  Flow B authorize    POST https://njgrm.buru-degree.ts.net/api/v1/auth/sso/authorize
  Flow B exchange     POST https://njgrm.buru-degree.ts.net/api/v1/auth/sso/exchange
Your reverse callback is registered exactly as
  https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/reverse/callback
We compare the redirect_uri strictly, so don't change it silently.

Four changes needed on your side:
 F1. Add "/api/v1" to BOTH ATLAS_SSO_REVERSE_AUTHORIZE_URL and ATLAS_SSO_REVERSE_EXCHANGE_URL.
     (Current values point at non-existent paths -> 404. Your code uses the env value verbatim.)
 F2. ATLAS_SSO_REVERSE_CLIENT_ID must be exactly "enrollpro". We validate that literal
     (companion-sso.service.ts:710, :573); "enrollpro_client_id" is rejected as a typed client error.
 F3. ROTATE ATLAS_SSO_CLIENT_SECRET. The published value is sha256("test") — trivially guessable,
     and it's the credential that authenticates ATLAS to you.
 F4. Both secrets were sent in a plaintext document, so treat both as compromised and re-provision
     out of band. If you rotate, send us the new value for the direction you rotated.

Key mapping (no renaming needed — we accept your key names):
  your ATLAS_SSO_CLIENT_SECRET         -> our ENROLLPRO_SSO_CLIENT_SECRET     (ATLAS -> EnrollPro)
  your ATLAS_SSO_REVERSE_CLIENT_SECRET -> our ATLAS_SSO_REVERSE_CLIENT_SECRET (EnrollPro -> ATLAS)
No additional value needs minting; both directions are covered by the two secrets you published.

Please send us, over a secure channel:
  1. the (rotated) ATLAS_SSO_CLIENT_SECRET value
  2. your canonical base URL, to set as our ENROLLPRO_BASE_URL
     (or confirm https://dev-jegs.buru-degree.ts.net)

ATLAS status: 0002_companion_sso_code migration APPLIED; routes mounted and returning 401 not 404.
Our env keys are not set yet and ride one deployment. Seven acceptance scenarios + replay/expiry/
wrong-secret/role-denial/log-hygiene are listed in the response doc — we can run them the moment
your F1/F2 land and our env is set.