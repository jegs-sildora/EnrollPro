# MRF SSO Integration Guide

## Overview
This document outlines how the MRF system should ingest the SSO login session from EnrollPro.

## 1. Configure EnrollPro Credentials
MRF must configure the following environment variable to match EnrollPro's settings:
- `ENROLLPRO_SSO_CLIENT_SECRET`: `<distinct server-only secret issued for MRF>`

## 2. Implement the Callback Endpoint
EnrollPro will redirect the user to your callback URL with an authorization code:
`GET https://mrf.buru-degree.ts.net/auth/sso/callback?code=<AUTHORIZATION_CODE>`

Your system must expose this endpoint to receive the code.

## 3. Exchange the Code for User Identity
When MRF receives the code, it must securely exchange it by making a server-to-server POST request to EnrollPro.

**Endpoint:** `POST https://<ENROLLPRO_API_URL>/api/auth/companion-sso/MRF/exchange`
**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <ENROLLPRO_SSO_CLIENT_SECRET>`

**Body:**
```json
{
  "code": "<AUTHORIZATION_CODE>"
}
```

## 4. Handle the Response
EnrollPro will return the user identity payload. Use this to automatically log the user into MRF:

```json
{
  "success": true,
  "companion": "MRF",
  "identity": {
    "subject": "ENROLLPRO_USER:1",
    "userId": 1,
    "employeeId": "EMP-123",
    "lrn": null,
    "firstName": "John",
    "middleName": "D",
    "lastName": "Doe",
    "roles": ["SYSTEM_ADMIN", "MRF"]
  },
  "activeSchoolYear": {
    "id": 1,
    "yearLabel": "2027-2028"
  },
  "authenticatedAt": "2026-09-01T10:00:00.000Z"
}
```
Use the `identity.userId` or `identity.employeeId` to map the user to your local MRF database, and create a local session.

## 5. Technical Specification & Implementation Details

To ensure a robust integration, please adhere to the following specifications:

### Initiation Flow (EnrollPro → Companion)
When a user clicks to open your system within EnrollPro, EnrollPro performs an internal reachability check. If successful, it generates a secure `code` and redirects the user to your registered Callback URL (e.g., `?code=...`). **Redirect URIs are strictly registered and whitelisted via backend environment variables within EnrollPro**. There is no `/initiate` endpoint exposed to external systems.

### Code Semantics & Lifecycle
- **Time-to-Live (TTL)**: The authorization code strictly expires after **60 seconds**.
- **Single-Use**: Codes are strictly single-use. Once exchanged successfully, they are instantly consumed.
- **Error Handling**: If your system attempts to exchange an invalid, expired, or already-consumed code, EnrollPro will return an HTTP **401 Unauthorized** with the exact message: `"The SSO authorization code is invalid, expired, or already used."` Your system must gracefully handle this by instructing the user to start again from EnrollPro. Do not retry the exchange.

### Canonical Exchange Schema
The JSON response provided in Step 4 is the **authoritative schema**.
- It uses `activeSchoolYear` (containing `id` and `yearLabel`), **not** `schoolYear`.
- There are **no** `isActive` flags present in either the `identity` or `activeSchoolYear` objects.

### Roles and Subject Format
- **Subject**: The `identity.subject` field will always follow the format `ENROLLPRO_USER:<userId>` (e.g., `ENROLLPRO_USER:1`). The `userId` field is strictly numeric and is always present.
- **Roles**: The `roles` array will only contain roles that your specific companion system is explicitly authorized to access.
  - For AIMS, SMART, and ATLAS: `SYSTEM_ADMIN`, `HEAD_REGISTRAR`, `TEACHER`, `CLASS_ADVISER`.
  - For MRF: `SYSTEM_ADMIN`, `MRF`.

### Reverse Direction (Companion → EnrollPro)
EnrollPro implements a signed-state, one-time-code reverse flow. Do not send a reusable JWT or shared browser cookie. Implement the authorization and exchange endpoints defined in [Integrated Systems Sidebar and SSO](../features/integration/INTEGRATED-SYSTEMS-SIDEBAR-SSO.md) before enabling the EnrollPro sidebar item.
