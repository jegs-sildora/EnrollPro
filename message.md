# TERM_CHANGED — Cross-Service Calendar Event Contract

**Audience:** EnrollPro (publisher) · AIMS · ATLAS · SMART (subscribers)
**Owner of the calendar:** EnrollPro (**EP is the single source of truth** for terms and term boundaries)
**Bus:** RabbitMQ, hosted on the AIMS host over Tailscale
**Status:** v1 payload is live (AIMS publishes, test-only). **v2 (this doc) makes EP the publisher** and AIMS/ATLAS/SMART pure subscribers.

> This is the one file every service reads to know **exactly** how term transitions are announced. If you change the exchange, payload, or credentials, update **this file first** — it is the contract.

---

## 0. Roles at a glance

| Service | Role | Does |
|---|---|---|
| **EnrollPro** | **Publisher / owner** | Owns term dates. When the real date (or a mocked date) crosses a term boundary, publishes one `TERM_CHANGED`. |
| **AIMS** | Subscriber (+ broker host) | Consumes the event → persists `School.currentSchoolYearId` + `lastRolloverAt`, emits SSE `term-changed`. **Never republishes.** |
| **ATLAS** | Subscriber | Consumes the event → refreshes its active term and republishes the schedule (kills the stale-T1 drift). |
| **SMART** | Subscriber | Consumes the event → re-scopes grading weights to the new term. |

**Rule:** the system that owns the truth publishes it. Consumers never re-emit on the same exchange.

---

## 1. Topology

```
                 publish (persistent, confirms)
  EnrollPro ────────────────────────────────▶  RabbitMQ  (AIMS host)
  (owns calendar)                              exchange: aims.calendar.fanout  (fanout, durable)
                                                    │
                            ┌───────────────────────┼───────────────────────┐
                            ▼                       ▼                       ▼
                    term-events.aims       term-events.atlas       term-events.smart
                       (AIMS)                  (ATLAS)                 (SMART)
```

A **fanout** exchange delivers **one copy to every bound queue**. A fanout with **no bound queue drops the message** — every consumer must declare + bind its queue **before** an event is published.

---

## 2. Connection facts (exact)

| Item | Value |
|---|---|
| **AMQP URL (from any tailnet peer)** | `amqp://aims:aims_dev@100.92.245.14:5672` |
| **AMQP URL (on the AIMS host itself)** | `amqp://aims:aims_dev@localhost:5672` |
| **Management UI** | `http://100.92.245.14:15672` — user `aims`, pass `aims_dev` |
| **vhost** | `/` |
| **Exchange name** | `aims.calendar.fanout` |
| **Exchange type / durability** | `fanout` / `durable: true` |
| **Routing key** | `""` (fanout ignores it) |
| **Reachability** | **Tailnet only.** No Funnel, no public ingress. All peers must be on the same Tailscale network. |
| **Broker host** | AIMS host, Tailscale IP `100.92.245.14` |
| **Source hosts** | EnrollPro `https://dev-jegs.buru-degree.ts.net/api` · ATLAS `https://njgrm.buru-degree.ts.net/api/v1` |

> **Credentials are non-production.** They are committed for dev convenience (`docker-compose.yml`, `server/.env`). **Rotate before production** and give each service its own broker user (see §7).

---

## 3. Event contract

### v1 — current (published by AIMS, test-only)

```json
{ "event": "TERM_CHANGED", "from_term": "Term 1", "to_term": "Term 2", "timestamp": "<ISO-8601 UTC>" }
```

### v2 — target (published by EnrollPro)

```json
{
  "event": "TERM_CHANGED",
  "eventId": "0f2b9c1e-7a44-4c31-9b8d-2f1a6e5d0c33",
  "source": "enrollpro",
  "producedBy": "ep-mock-clock",
  "schoolId": "school-a",
  "schoolYearId": 10,
  "from": { "term": "T1", "termIndex": 1, "label": "TERM 1" },
  "to":   { "term": "T2", "termIndex": 2, "label": "TERM 2" },
  "effectiveDate": "2026-09-20",
  "timestamp": "2026-09-19T16:00:00.000Z",

  "from_term": "TERM 1",
  "to_term": "TERM 2"
}
```

**Field rules:**

| Field | Required | Notes |
|---|---|---|
| `event` | ✅ | Always `"TERM_CHANGED"`. |
| `eventId` | ✅ | UUID, unique per publish. Consumers **dedup on this**. |
| `source` | ✅ | `"enrollpro"`. |
| `producedBy` | optional | `"ep-scheduler"` (real time) or `"ep-mock-clock"` (test). |
| `schoolId` | ✅ | AIMS school id (e.g. `school-a`). One event per affected school. |
| `schoolYearId` | ✅ | Numeric EP school-year id. AIMS persists this as `currentSchoolYearId`. |
| `from` / `to` | ✅ | `{ term, termIndex, label }`. `termIndex` = integer `1..4`. |
| `effectiveDate` | ✅ | `YYYY-MM-DD` the new term starts. |
| `timestamp` | ✅ | ISO-8601 UTC of production. |
| `from_term` / `to_term` | ✅ | **Backward-compat** human strings; keep so v1 consumers don't break. |

> **Why v2?** v1's labels alone cannot drive a DB update — AIMS needs `schoolYearId`/`termIndex`/`schoolId` to persist the rollover, and every consumer needs `eventId` to be idempotent.

---

## 4. For EnrollPro — how to publish

**Responsibilities**
1. Own the term calendar (it already does: `GET /integration/v1/school-year` → `terms[]`).
2. Detect a boundary: real clock crossing an EP term `startDate`, **or** a mocked date crossing one in a test harness.
3. Publish **exactly one** `TERM_CHANGED` per crossed boundary **per affected school**.
4. Use a **confirm channel** + **persistent** messages. Never publish before declaring the exchange.

**Node.js (amqplib) — publisher with confirms**

```js
import amqp from 'amqplib'
import { randomUUID } from 'node:crypto'

const URL = process.env.RABBITMQ_URL ?? 'amqp://aims:aims_dev@100.92.245.14:5672'
const EXCHANGE = 'aims.calendar.fanout'

export async function publishTermChanged(school, fromTerm, toTerm) {
  const conn = await amqp.connect(URL)
  const ch = await conn.createConfirmChannel()          // confirms, not createChannel
  await ch.assertExchange(EXCHANGE, 'fanout', { durable: true })

  const event = {
    event: 'TERM_CHANGED',
    eventId: randomUUID(),
    source: 'enrollpro',
    producedBy: 'ep-scheduler',
    schoolId: school.id,
    schoolYearId: toTerm.schoolYearId,
    from: { term: fromTerm.identity, termIndex: fromTerm.index, label: fromTerm.label },
    to:   { term: toTerm.identity,   termIndex: toTerm.index,   label: toTerm.label },
    effectiveDate: toTerm.startDate,
    timestamp: new Date().toISOString(),
    from_term: fromTerm.label,
    to_term: toTerm.label,
  }

  ch.publish(EXCHANGE, '', Buffer.from(JSON.stringify(event)), {
    persistent: true,
    contentType: 'application/json',
  })
  await ch.waitForConfirms()                             // broker ACK
  await ch.close()
  await conn.close()
}
```

**Python (pika) — publisher with publisher confirms**

```python
import os, json, uuid, datetime, pika

URL = os.environ.get("RABBITMQ_URL", "amqp://aims:aims_dev@100.92.245.14:5672")
EXCHANGE = "aims.calendar.fanout"

params = pika.URLParameters(URL)
conn = pika.BlockingConnection(params)
ch = conn.channel()
ch.exchange_declare(exchange=EXCHANGE, exchange_type="fanout", durable=True)
ch.confirm_delivery()

event = {
    "event": "TERM_CHANGED",
    "eventId": str(uuid.uuid4()),
    "source": "enrollpro",
    "schoolId": "school-a",
    "schoolYearId": 10,
    "from": {"term": "T1", "termIndex": 1, "label": "TERM 1"},
    "to":   {"term": "T2", "termIndex": 2, "label": "TERM 2"},
    "effectiveDate": "2026-09-20",
    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "from_term": "TERM 1",
    "to_term": "TERM 2",
}
ch.basic_publish(
    exchange=EXCHANGE, routing_key="",
    body=json.dumps(event).encode(),
    properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
)
conn.close()
```

**Mocking a rollover (for EP's test harness)**
- Provide EP a mock-date switch (analogous to AIMS's `AIMS_ENABLE_VIRTUAL_CLOCK`).
- When the mocked date crosses a term `startDate`, call `publishTermChanged(...)`.
- Keep the mock path **non-production-gated** and stamp `producedBy: "ep-mock-clock"` so consumers can distinguish test events.

---

## 5. For AIMS / ATLAS / SMART — how to subscribe

**Every consumer must:**
1. Assert the exchange: `assertExchange('aims.calendar.fanout', 'fanout', { durable: true })`.
2. Declare its **own durable, named** queue: `term-events.aims` / `term-events.atlas` / `term-events.smart`.
3. Bind it (`bindQueue(queue, EXCHANGE, '')`).
4. `consume` with **manual ack** (`{ noAck: false }`); ack only after the handler succeeds.
5. **Dedup on `eventId`** (at-least-once delivery ⇒ duplicates possible).
6. Auto-reconnect on broker loss.

**Node.js (amqplib) — durable subscriber**

```js
import amqp from 'amqplib'

const URL = process.env.RABBITMQ_URL ?? 'amqp://aims:aims_dev@100.92.245.14:5672'
const EXCHANGE = 'aims.calendar.fanout'
const QUEUE = 'term-events.aims'          // one per service

const seen = new Set()                     // replace with durable dedup in prod

const start = async () => {
  const conn = await amqp.connect(URL)
  const ch = await conn.createChannel()
  await ch.assertExchange(EXCHANGE, 'fanout', { durable: true })
  await ch.assertQueue(QUEUE, { durable: true })
  await ch.bindQueue(QUEUE, EXCHANGE, '')

  ch.consume(QUEUE, async (msg) => {
    if (!msg) return
    try {
      const evt = JSON.parse(msg.content.toString())
      if (evt.eventId && seen.has(evt.eventId)) return ch.ack(msg)
      // ... handle rollover for your service ...
      if (evt.eventId) seen.add(evt.eventId)
      ch.ack(msg)
    } catch (err) {
      console.error('[term-events] handler failed, requeue:', err)
      ch.nack(msg, false, true)            // requeue
    }
  }, { noAck: false })

  conn.on('error', () => setTimeout(start, 5000))   // reconnect
  conn.on('close', () => setTimeout(start, 5000))
}
start()
```

**Python (pika) — durable subscriber**

```python
import os, json, pika

URL = os.environ.get("RABBITMQ_URL", "amqp://aims:aims_dev@100.92.245.14:5672")
EXCHANGE, QUEUE = "aims.calendar.fanout", "term-events.aims"

conn = pika.BlockingConnection(pika.URLParameters(URL))
ch = conn.channel()
ch.exchange_declare(exchange=EXCHANGE, exchange_type="fanout", durable=True)
ch.queue_declare(queue=QUEUE, durable=True)
ch.queue_bind(queue=QUEUE, exchange=EXCHANGE, routing_key="")

def handle(ch, method, props, body):
    evt = json.loads(body)
    # ... handle rollover ...
    ch.basic_ack(delivery_tag=method.delivery_tag)   # ack after success

ch.basic_qos(prefetch_count=1)
ch.basic_consume(queue=QUEUE, on_message_callback=handle, auto_ack=False)
ch.start_consuming()
```

**Per-service handler responsibilities**

| Service | On `TERM_CHANGED` |
|---|---|
| **AIMS** | `School.currentSchoolYearId = schoolYearId`, `lastRolloverAt = timestamp`; emit SSE `term-changed` to connected clients. **Do not republish.** |
| **ATLAS** | Refresh active term from the event (`to.termIndex`) and republish the schedule for that term — this removes the stale-T1 drift caused by the broken EP pull key. |
| **SMART** | Re-scope active grading weights to `to.termIndex`. |

---

## 6. Delivery semantics & idempotency

- **At-least-once.** RabbitMQ + manual ack ⇒ a consumer can see the same `eventId` twice. Dedup by `eventId`; fall back to `schoolId:schoolYearId:to.termIndex` when `eventId` is absent (v1).
- **Persistent.** Publisher sets `persistent: true` + `delivery_mode: 2`; exchange and consumer queues are `durable`.
- **Ordering.** Fanout does not guarantee cross-queue ordering. A consumer must be order-insensitive: keep the *latest* `schoolYearId`/`termIndex` (compare, don't blindly overwrite backwards).
- **No queue = dropped.** A service that is offline with **no durable queue bound** misses the event. Always bind a durable queue at boot.

---

## 7. Security

- The broker is **Tailscale-only** (`100.92.245.14`); never expose `5672`/`15672` publicly.
- `aims` / `aims_dev` are **dev credentials**. For production:
  - Rotate via `RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASS` (or a `docker-compose.override.yml`).
  - Prefer **one broker user per service** with permissions limited to the shared exchange + its own queue.
  - Use a real secret store; never commit prod creds.
- Payload carries no secrets — term metadata only.

---

## 8. Testing (mock clock, end-to-end)

1. Start the broker (AIMS host):
   ```bash
   docker compose up -d          # aims-rabbitmq on 5672 / 15672
   ```
2. Bind the durable inspector so events are retained even with no live consumer:
   ```bash
   node scripts/term-events/bind-inspector.mjs      # queue: term-events.inspector
   ```
3. Start a subscriber to watch the flow:
   ```bash
   RABBITMQ_URL="amqp://aims:aims_dev@100.92.245.14:5672" node scripts/term-events/consume.mjs
   ```
4. On EP, mock the clock across a term `startDate` so it publishes `TERM_CHANGED`.
5. Verify:
   - Inspector/consumer prints the event.
   - AIMS logs the rollover + SSE `term-changed`.
   - ATLAS/SMART handlers fire.
6. Inspect queued messages via the management UI: `http://100.92.245.14:15672` → **Queues and Streams → `term-events.inspector` → Get messages**.

---

## 9. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Event published, nobody receives | No queue bound (fanout drops it). Bind `term-events.<service>` first. |
| `ECONNREFUSED` / connect timeout | Broker down, or peer not on Tailscale. Check `docker ps`, `tailscale status`, host firewall for the tailnet interface. |
| Subscriber gets duplicate events | At-least-once delivery. Dedup by `eventId`. |
| AIMS rolls back to an older term | Order-insensitivity bug: compare `schoolYearId`/`termIndex`, only advance. |
| Nothing on a PATCH / mock | Date didn't cross a boundary, or the mock path isn't publishing. Check `producedBy` in the event. |
| Management UI unreachable from a peer | Use the Tailscale IP (`100.92.245.14:15672`), not `localhost`. |

---

## 10. Compatibility & migration (v1 → v2)

1. **AIMS** stops publishing on its own virtual-clock boundary and instead **consumes** the EP event. Its `handleTermTransition` splits: *apply rollover + SSE* (on inbound) vs *publish* (removed for this flow).
2. v1 `from_term`/`to_term` stay in the v2 payload so any v1-only consumer keeps working during migration.
3. Consumers should accept **both** shapes: prefer `to.termIndex`/`schoolYearId`; fall back to parsing `to_term`.
4. Only then retire AIMS's virtual clock as a *cross-service* trigger (keep it for AIMS-local tests).

---

## 11. References

- `docs/VIRTUAL-CALENDAR-SETUP.md` — run the broker + AIMS mock clock locally.
- `docs/ARCHITECTURE_MICROSERVICES.md` §"Event Subscription" — topology context.
- `server/src/services/term-events.publisher.ts` — AIMS current publisher (v1) + outbox/retry.
- `server/src/services/term-bounds.service.ts` — EP `terms[]` cache + active-term resolution.
- `scripts/term-events/` — ready-to-run consumers + inspector binder.
