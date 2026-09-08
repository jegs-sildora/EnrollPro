## 3. Resolving Redirect Allowlist Errors

If you encounter a framework error similar to:
> "The navigation route /auth/enrollpro/authorize... is not being used, since the URL being navigated to doesn't match the allowlist"

This is caused by the AIMS frontend framework's security layer intercepting the HTTP redirect. The authorization endpoint must redirect the user back to EnrollPro (e.g., "https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/aims/reverse/callback").

Because EnrollPro's domain is external to AIMS, strict framework policies (like Next.js Server Action redirect policies, Expo Router deep linking, or Tauri navigation allowlists) will block the outbound navigation unless explicitly permitted.

### How to Fix:
1. **Identify the Framework Security Policy**: Locate where your framework restricts outbound redirects or external navigation.
2. **Allow EnrollPro's Domain**: Add "https://dev-jegs.buru-degree.ts.net" (and your production EnrollPro domain) to the allowed redirect origins or navigation allowlist.
3. **Use Native Redirects**: If client-side routing still intercepts it, ensure the redirect is performed as a hard browser navigation (e.g., "window.location.href = redirect_uri") rather than a soft SPA route push.