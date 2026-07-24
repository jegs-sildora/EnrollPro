# MRF API Guide

Last reviewed: 2026-07-24

## Boundary

MRF owns maintenance, facilities, and waste-management transactions. EnrollPro owns learner, personnel, and staff identity plus active school-year context.

MRF must not copy unrelated learner demographics or change EnrollPro records.

## Configuration

```text
ENROLLPRO_INTEGRATION_BASE_URL=https://configured-enrollpro-host/api/integration/v1
MRF_INTEGRATION_API_KEY=consumer-secret
```

The service key is sent only from the MRF backend:

```text
X-Integration-Key: consumer-secret
```

## Identity Feed

```text
GET /default/mrf/identities?schoolYearId=<id>
```

The response groups:

- currently enrolled learners
- active teachers
- active staff and MRF-role users

It includes stable identifiers, names, roles, account status, employee ID or LRN, and current grade or section where applicable.

It excludes passwords, birthdates, parent data, health data, audit metadata, and unrelated enrollment details.

## Errors

- `401` missing or invalid integration key
- `404` requested school year not found
- `500` unexpected EnrollPro failure

## Synchronization

Use an explicit school-year ID for reconciliation. Refresh identities after EnrollPro reports that atomic rollover committed and `/school-year` returns the new active year.

MRF maintenance records remain in MRF when a learner or staff account becomes inactive. Use the EnrollPro status to prevent new transactions without erasing MRF history.

See [Microservice Architecture](../../../ARCHITECTURE_MICROSERVICES.md) and [Integration API v1](INTEGRATION_API_V1.md).

