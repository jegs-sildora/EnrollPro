# MRF SSO Integration Guide

## Overview
This document outlines how the MRF system should ingest the SSO login session from EnrollPro.

## 1. Configure EnrollPro Credentials
MRF must configure the following environment variable to match EnrollPro's settings:
- `ENROLLPRO_SSO_CLIENT_SECRET`: `2c624232cdd221771294dfbb310aca000a0df6ac8b66b696d90ef06fdefb64a3`

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
