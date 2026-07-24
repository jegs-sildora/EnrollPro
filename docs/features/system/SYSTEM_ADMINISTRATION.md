# System Administration

Last reviewed: 2026-07-24

## School Configuration

System Configuration manages school identity, DepEd school ID, address, contact details, uploaded logo, curriculum programs, enrollment dates, operational settings, school years, and calendar policies.

The uploaded logo supplies the EnrollPro primary and accent colors. Configuration changes must not introduce a separate SMART color theme.

## Accounts

System administrators manage staff accounts, roles, active access, password resets, and personnel portal access. Personnel service status and account access are related but separate controls.

## Activity Logs

Activity logs record significant administrative actions with actor, timestamp, action, affected record, and available school-year context. Logs are operational evidence and must not expose passwords or secret values.

## System Health

System health reports API, database, integration configuration, and service availability. A companion service outage must not transfer ownership of its data into EnrollPro.

## Historical Corrections

Historical correction controls require explicit authorization, a reason, and an audit record. Archived views are read-only except through a dedicated correction operation.

## Integration Administration

Integration endpoints and keys are documented in [EnrollPro API](../integration/ENROLLPRO-API.md). Keys remain in environment configuration and must never appear in activity-log metadata or client responses.
