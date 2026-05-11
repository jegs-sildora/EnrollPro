# Ecosystem Sync & Auth Bridge Architecture Plan

## 1. Process Analysis: EcosystemSync (EnrollPro as IdP)
The `EcosystemSync` module establishes EnrollPro as the Single Source of Truth (SSOT) and Identity Provider (IdP) for the DepEd ecosystem (ATLAS, SMART, AIMS).

**The Current Flow:**
1. **Account Provisioning:** The `/provision-teachers` endpoint iterates over `teacher` records and generates `user` login credentials with a default password and a `mustChangePassword` flag.
2. **Sync Triggering:** The frontend requests "Delta Sync" (pending only) or "Full Sync" (all records).
3. **Payload Generation:** The backend batches records and maps them into subsystem-specific payloads (demographics, section info, roles).
4. **Federation Execution:** The backend pushes payloads to target subsystem endpoints over Tailscale VPN (`buru-degree.ts.net`).
5. **Progress Monitoring:** Uses an in-memory `syncJobs` Map and 1-second short-polling from the client.

## 2. Plan: Bridging Token Authentication
To federate access so users can log into ATLAS, SMART, and AIMS using EnrollPro credentials:

**Proposed Architecture: Centralized IdP with OIDC/JWT**
*   **Single Sign-On (SSO):** EnrollPro acts as the central Authorization Server.
*   **Token Verification:** Expose a `/.well-known/jwks.json` endpoint on EnrollPro so downstream systems can verify JWT signatures locally.
*   **Shared Identity:** If subdomains are used (`*.buru-degree.ts.net`), use a secure, HTTP-only JWT cookie scoped to the parent domain.
*   **Service-to-Service (M2M):** Use OAuth2 Client Credentials flow for background synchronization between services.

## 3. Communication: SSE vs. Polling
**Verdict: Server-Sent Events (SSE) is the recommended path for a microservice architecture.**

*   **Efficiency:** SSE maintains a single long-lived connection, reducing HTTP overhead compared to repeated polling.
*   **Real-time:** Updates are pushed instantly from server to client as they happen.
*   **Scalability:** SSE (when paired with Redis Pub/Sub) allows progress updates to be broadcast regardless of which server instance the client is connected to.

## 4. Infrastructure: Redis Strategy
**Recommendation: Single Shared Instance with Key Prefixing.**
*   **Logical Separation:** Use prefixes like `enrollpro:`, `atlas:`, etc., to prevent key collisions.
*   **Cost-Effective:** Minimizes infrastructure overhead for school-level deployments.
*   **Event Bus:** Can double as a central message bus for Pub/Sub events (e.g., notifying subsystems when a new account is provisioned).

---

## Clarifying Questions for Implementation
1. **Auth Topology:** Should subsystems maintain their own password hashes (Push Sync), or should they delegate all login logic to EnrollPro (True SSO/OIDC)?
2. **Network/Domain:** Are all systems strictly on `*.buru-degree.ts.net` subdomains?
3. **Resource Availability:** Is Redis currently available in the deployment environment, or should we design for a Postgres-only fallback for job state?
4. **Data Pull Logic:** The request mentioned systems "pulling" faculty accounts. Should we implement a Pull API or stick to the current orchestrated "Push" model?
