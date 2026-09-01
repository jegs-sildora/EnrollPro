# ATLAS SSO Integration Guide

## Overview
This document outlines how the ATLAS system should ingest the SSO login session from EnrollPro.

## 1. Configure EnrollPro Credentials
ATLAS must configure the following environment variable to match EnrollPro's settings:
- `ENROLLPRO_SSO_CLIENT_SECRET`: `9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08`

## 2. Implement the Callback Endpoint
EnrollPro will redirect the user to your callback URL with an authorization code:
`GET https://njgrm.buru-degree.ts.net/auth/sso/callback?code=<AUTHORIZATION_CODE>`

Your system must expose this endpoint to receive the code.

## 3. Exchange the Code for User Identity
When ATLAS receives the code, it must securely exchange it by making a server-to-server POST request to EnrollPro.

**Endpoint:** `POST https://<ENROLLPRO_API_URL>/api/auth/companion-sso/ATLAS/exchange`
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
EnrollPro will return the user identity payload. Use this to automatically log the user into ATLAS:

```json
{
  "success": true,
  "companion": "ATLAS",
  "identity": {
    "subject": "ENROLLPRO_USER:1",
    "userId": 1,
    "employeeId": "EMP-123",
    "lrn": null,
    "firstName": "John",
    "middleName": "D",
    "lastName": "Doe",
    "roles": ["SYSTEM_ADMIN", "HEAD_REGISTRAR", "TEACHER", "CLASS_ADVISER"]
  },
  "activeSchoolYear": {
    "id": 1,
    "yearLabel": "2027-2028"
  },
  "authenticatedAt": "2026-09-01T10:00:00.000Z"
}
```
Use the `identity.userId` or `identity.employeeId` to map the user to your local ATLAS database, and create a local session.
