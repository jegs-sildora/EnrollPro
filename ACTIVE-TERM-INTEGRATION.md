# Active Term Integration Instructions

This document provides instructions for dependent microservices (SMART, ATLAS, and AIMS) to integrate with the active term state from the EnrollPro master configuration node.

## Active Term Endpoint
**Endpoint:** `GET /api/integration/v1/active-term`
**Base URL:** The configured `ENROLLPRO_INTEGRATION_BASE_URL` (e.g., `https://configured-enrollpro-host/api/integration/v1`)
**Method:** `GET`
**Authentication:** `X-Integration-Key` header with the secure internal integration key.

### Mandate
Dependent microservices are **strictly instructed** to implement a pull mechanism for the active term state. These services must query this specific EnrollPro endpoint:
1. Every time a user session initializes.
2. Every time a critical module loads.

This guarantees that all dependent systems always receive the absolute most current temporal state directly from the master configuration node. The endpoint runs on-the-fly date comparison logic evaluating the server timestamp against the stored grading period boundaries whenever pinged.

### Security
It is protected from external public access and requires secure internal authentication tokens (`X-Integration-Key`) so only official approved microservices can request the active term data, preventing unauthorized temporal manipulation.

### Example Payload
```json
{
  "data": {
    "activeTerm": "T1",
    "activeTermLabel": "QUARTER 1",
    "termFormat": "QUARTERS",
    "schoolYearId": 1
  }
}
```
