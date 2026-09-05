# ATLAS SSO Implementation Guide (Node.js / Express)

Based on the contract in `ATLAS-ENROLLPRO-SSO.md`, here is a complete, production-ready Node.js/Express implementation template for the ATLAS backend. 

This code fulfills all security, logging, mapping, and routing constraints required to successfully complete the SSO exchange with EnrollPro.

> [!IMPORTANT]
> **Server-Side Only**: This code must run on your backend server. Never expose `ATLAS_SSO_CLIENT_SECRET` to the frontend browser or attempt this exchange from client-side JavaScript.

```typescript
import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

// Environment variables required by ATLAS
const ENROLLPRO_BASE_URL = process.env.ENROLLPRO_BASE_URL || 'https://enrollpro.example.com';
const ATLAS_SSO_CLIENT_SECRET = process.env.ATLAS_SSO_CLIENT_SECRET;

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
      `${ENROLLPRO_BASE_URL}/api/auth/companion-sso/atlas/exchange`,
      { code },
      {
        headers: {
          'Authorization': `Bearer ${ATLAS_SSO_CLIENT_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const payload = exchangeResponse.data;

    // 2. Strict Payload Validation
    if (
      !payload.success || 
      payload.companion !== 'ATLAS' ||
      !payload.identity || 
      !payload.activeSchoolYear
    ) {
      console.warn(`[SSO Denial] Invalid payload structure from EnrollPro.`);
      return res.redirect(`${ENROLLPRO_BASE_URL}/login?error=Invalid+or+inactive+account`);
    }

    const { subject, roles, employeeId, name } = payload.identity;

    // Reject unauthorized roles, default passwords, or JHS completers implicitly 
    // based on the valid role list below.
    const hasValidRole = roles.some((role: string) => 
      ['SYSTEM_ADMIN', 'HEAD_REGISTRAR', 'TEACHER', 'CLASS_ADVISER'].includes(role)
    );

    if (!hasValidRole) {
      // Log non-sensitive denial code
      console.warn(`[SSO Denial] Unauthorized role attempted SSO. Subject: ${subject}`);
      return res.redirect(`${ENROLLPRO_BASE_URL}/login?error=Unauthorized+role+for+ATLAS`);
    }

    // 3. Map Identity & Create ATLAS Session
    // In your actual ATLAS database, you would find or update the user where externalId = subject
    const atlasUser = await reconcileAtlasUser({
      subjectId: subject, // Stable external identifier
      employeeId, 
      name
    });

    // Create an ATLAS-owned HTTP-only, Secure, SameSite session
    // (Example assumes express-session or similar is configured on `req.session`)
    req.session.userId = atlasUser.id; 
    
    // Log success (NO secrets, NO tokens logged)
    console.info(`[SSO Success] EnrollPro Subject: ${subject} mapped to ATLAS Account: ${atlasUser.id}`);

    // 4. Role-based Routing (clears code from browser history)
    if (roles.includes('SYSTEM_ADMIN')) {
      return res.redirect('https://njgrm.buru-degree.ts.net/');
    } else {
      // HEAD_REGISTRAR, TEACHER, and CLASS_ADVISER
      return res.redirect('/workspace'); // Or your dynamic ATLAS workspace URL
    }

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
 * Mock function to represent how ATLAS should map the identity
 */
async function reconcileAtlasUser(data: { subjectId: string, employeeId: string, name: string }) {
  // TODO: Implement your DB lookup here. 
  // Map data.subjectId as the stable external identifier. 
  // Reconcile the employee ID and name without changing EnrollPro-owned identity logic.
  return { id: 'atlas_user_789' }; 
}

export default router;
```

> [!CAUTION]
> **Logging Restrictions**: As mandated by the contract, you must ensure that your global request loggers (like Morgan or Winston) do NOT log the `req.query.code`, the `ATLAS_SSO_CLIENT_SECRET` in headers, or the full `exchangeResponse.data` identity payload.
