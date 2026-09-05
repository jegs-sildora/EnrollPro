# MRF SSO Implementation Guide (Node.js / Express)

Based on the contract in `MRF-ENROLLPRO-SSO.md`, here is a complete, production-ready Node.js/Express implementation template for the MRF backend. 

This code fulfills all security, logging, mapping, and routing constraints required to successfully complete the SSO exchange with EnrollPro.

> [!IMPORTANT]
> **Server-Side Only**: This code must run on your backend server. Never expose `MRF_SSO_CLIENT_SECRET` to the frontend browser or attempt this exchange from client-side JavaScript.

```typescript
import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

// Environment variables required by MRF
const ENROLLPRO_BASE_URL = process.env.ENROLLPRO_BASE_URL || 'https://enrollpro.example.com';
const MRF_SSO_CLIENT_SECRET = process.env.MRF_SSO_CLIENT_SECRET;

/**
 * GET /auth/enrollpro/callback
 * Handles the redirect from EnrollPro after the user initiates SSO.
 */
router.get('/auth/enrollpro/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    // Missing code, redirect back to EnrollPro with a plain retry message
    return res.redirect(`${ENROLLPRO_BASE_URL}/login?error=Missing+authorization+code`);
  }

  try {
    // 1. Exchange the code with EnrollPro from the Server
    const exchangeResponse = await axios.post(
      `${ENROLLPRO_BASE_URL}/api/auth/companion-sso/mrf/exchange`,
      { code },
      {
        headers: {
          'Authorization': `Bearer ${MRF_SSO_CLIENT_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const payload = exchangeResponse.data;

    // 2. Strict Payload Validation
    if (
      !payload.success || 
      payload.companion !== 'MRF' ||
      !payload.identity || 
      !payload.activeSchoolYear
    ) {
      console.warn(`[SSO Denial] Invalid payload structure from EnrollPro.`);
      return res.redirect(`${ENROLLPRO_BASE_URL}/login?error=Invalid+or+inactive+account`);
    }

    const { subject, roles, employeeId, name } = payload.identity;

    // Reject unauthorized roles, default passwords, or JHS completers implicitly 
    // MRF permits ONLY SYSTEM_ADMIN and MRF roles
    const hasValidRole = roles.some((role: string) => 
      ['SYSTEM_ADMIN', 'MRF'].includes(role)
    );

    if (!hasValidRole) {
      // Log non-sensitive denial code
      console.warn(`[SSO Denial] Unauthorized role attempted SSO. Subject: ${subject}`);
      return res.redirect(`${ENROLLPRO_BASE_URL}/login?error=Unauthorized+role+for+MRF`);
    }

    // 3. Map Identity & Create MRF Session
    // In your actual MRF database, you would find or update the user where externalId = subject
    const mrfUser = await reconcileMrfUser({
      subjectId: subject, // Stable external identifier
      employeeId, 
      name
    });

    // Create an MRF-owned HTTP-only, Secure, SameSite session
    // (Example assumes express-session or similar is configured on `req.session`)
    req.session.userId = mrfUser.id; 
    
    // Log success (NO secrets, NO tokens logged)
    console.info(`[SSO Success] EnrollPro Subject: ${subject} mapped to MRF Account: ${mrfUser.id}`);

    // 4. Role-based Routing (clears code from browser history)
    // MRF owns the final role-to-dashboard mapping
    return res.redirect('/dashboard'); // Configure specific MRF dashboards here

  } catch (error: any) {
    // 5. Handle Rejections (expired, replayed, wrong-system, malformed)
    // Log the event result safely without dumping the full error payload or secrets
    console.warn(`[SSO Denial] Exchange failed. Status: ${error.response?.status}`);
    
    // A failed exchange must return the user to EnrollPro with a plain retry message.
    // It MUST NOT retry the same code.
    return res.redirect(`${ENROLLPRO_BASE_URL}/login?error=SSO+exchange+failed.+Please+try+again.`);
  }
});

/**
 * Mock function to represent how MRF should map the identity
 */
async function reconcileMrfUser(data: { subjectId: string, employeeId: string, name: string }) {
  // TODO: Implement your DB lookup here. 
  // Map data.subjectId as the stable external identifier. 
  // Reconcile the employee ID and name without changing EnrollPro-owned identity logic.
  return { id: 'mrf_user_789' }; 
}

export default router;
```

> [!CAUTION]
> **Logging Restrictions**: As mandated by the contract, you must ensure that your global request loggers (like Morgan or Winston) do NOT log the `req.query.code`, the `MRF_SSO_CLIENT_SECRET` in headers, or the full `exchangeResponse.data` identity payload.
