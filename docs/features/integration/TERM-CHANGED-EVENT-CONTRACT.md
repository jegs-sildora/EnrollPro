# EnrollPro TERM_CHANGED Event Contract

Last reviewed: 2026-09-23

## Purpose

EnrollPro is the sole authoritative publisher of `TERM_CHANGED`. The event tells
AIMS, ATLAS, and SMART that EnrollPro's configured school calendar has advanced
to a later term. It does not transfer ownership of grades, schedules, learning
activity, or companion sessions.

Delivery is at least once. EnrollPro persists one logical event per school,
school year, and adjacent term boundary. Retries retain the same `eventId`.
Consumers must therefore deduplicate durably by `eventId`.

## Broker Topology

| Setting | Contract |
| --- | --- |
| Exchange | `aims.calendar.fanout` |
| Type | `fanout` |
| Durable | Yes |
| Routing key | Empty string |
| Message | Persistent JSON |
| Publisher confirms | Required |

EnrollPro asserts only the durable exchange. AIMS, ATLAS, and SMART each own
their durable queue, queue binding, reconnection policy, manual acknowledgement,
dead-letter policy, and durable `eventId` deduplication. EnrollPro does not
create or administer companion queues.

Actual broker URLs, usernames, and passwords are exchanged out of band. They
must not be committed, copied into documentation, returned by an API, or logged.

## Version 2 Payload

```json
{
  "event": "TERM_CHANGED",
  "eventId": "6f3dbeb6-ef70-4a0e-bcba-dbc98060bb24",
  "source": "enrollpro",
  "producedBy": "ep-scheduler",
  "schoolId": "school-a",
  "schoolYearId": 10,
  "from": {
    "term": "T1",
    "termIndex": 1,
    "label": "TERM 1"
  },
  "to": {
    "term": "T2",
    "termIndex": 2,
    "label": "TERM 2"
  },
  "effectiveDate": "2030-10-01",
  "timestamp": "2030-10-01T00:00:00.000Z",
  "from_term": "TERM 1",
  "to_term": "TERM 2"
}
```

`term` is the stable identity `T1` through `T4`. `label` is EnrollPro's stored
display label. `termIndex` is one-based calendar order. `from_term` and
`to_term` are compatibility fields and exactly match the structured labels.
`effectiveDate` is the destination term's configured start date.

`producedBy` is `ep-scheduler` during normal operation and `ep-mock-clock` only
for an explicitly enabled non-production verification run.

## Boundary Detection

Every 60 seconds EnrollPro:

1. Resolves the authoritative active school year using the fail-closed settings
   pointer and active-row check.
2. Builds and validates the ordered trimester or quarter contract.
3. Resolves the current date in `Asia/Manila` through the shared term resolver.
4. Compares that term with `SchoolYear.activeTerm`, the publisher checkpoint.
5. Acquires a PostgreSQL transaction advisory lock and writes the checkpoint
   and any outbox events in one serializable transaction.

A null checkpoint is initialized to the resolved term without inventing an old
transition. If several boundaries were crossed during downtime, EnrollPro
persists each adjacent transition in sequence. If calendar edits or clock
movement would move the checkpoint backward, EnrollPro publishes nothing,
keeps the checkpoint unchanged, and logs a warning for administrator review.

School-year create and update requests cannot write `activeTerm`. Calendar
dates determine the current term and the publisher owns the checkpoint.

## Outbox And Retry

The `term_changed_event_outbox` table stores the stable UUID, school scope,
boundary, effective date, validated JSON payload, attempts, retry time, lease,
publication time, and a sanitized error classification. A database uniqueness
constraint prevents duplicate logical boundaries.

The publisher claims eligible rows with a short lease, publishes with a confirm
channel, and marks the row published only after broker confirmation. Failed
attempts return to pending state with bounded exponential backoff. Broker
failure never blocks the HTTP server or discards a detected transition.

A process may fail after RabbitMQ confirms but before the database update. The
next attempt then sends the same payload and `eventId`; this is why subscriber
deduplication is mandatory.

## Consumer Requirements

AIMS, ATLAS, and SMART must:

- bind a separately named durable queue to the exchange;
- use manual acknowledgements and acknowledge only after local persistence;
- reconnect and resume consumption after broker or network outages;
- record processed `eventId` values durably and treat duplicates as success;
- validate the complete v2 payload before changing local state;
- use `schoolYearId` and stable term identities for scope, not display labels;
- reject or quarantine malformed, wrong-school, or backward events;
- never republish an authoritative EnrollPro term transition.

Companions remain subscribers only. Polling the school-year API may be used for
reconciliation, but it must not create a second authoritative event stream.

## Configuration

EnrollPro uses these server-only variables:

```text
RABBITMQ_URL=amqp://service_user:service_password@rabbitmq-host:5672
TERM_EVENTS_EXCHANGE=aims.calendar.fanout
TERM_EVENTS_SCHOOL_ID=school-a
TERM_EVENTS_SCHEDULER_INTERVAL_MS=60000
TERM_EVENTS_PUBLISH_INTERVAL_MS=5000
TERM_EVENTS_ENABLE_MOCK_CLOCK=false
```

Known development credentials are refused when `NODE_ENV=production`.

## Non-Production Mock Clock

The command below invokes the same coordinator and outbox publisher. It is not
an alternate event implementation.

```bash
TERM_EVENTS_ENABLE_MOCK_CLOCK=true pnpm --filter server term-events:tick -- --date=2030-10-01
```

The command rejects production and requires an explicit `YYYY-MM-DD` date. GET
requests and browser headers cannot trigger publication.

## Operational Checks

1. Confirm the active school year and term calendar are valid.
2. Confirm all companion-owned durable queues are bound before a joint test.
3. Run a mock tick before and after a boundary in non-production.
4. Confirm one logical event exists and each subscriber receives its copy.
5. Retry the outbox row and confirm the `eventId` is unchanged.
6. Stop RabbitMQ temporarily and confirm EnrollPro remains available and later
   publishes the queued event after reconnection.

Live broker verification requires the private RabbitMQ host to be reachable.
An unreachable host leaves events pending and is not treated as data loss.
