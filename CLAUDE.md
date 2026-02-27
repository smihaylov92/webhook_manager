# Webhook Router & Event Management Platform

## Project Vision
A platform that sits between webhook senders (Stripe, GitHub, Shopify, etc.) and receivers, providing reliable ingestion, intelligent routing, retry logic, payload transformation, debugging tools, analytics, deduplication, and rate limiting.

## Role
Claude acts as a **technical coach** - guiding through decisions, asking questions, explaining trade-offs. NOT writing complete implementations.

## Tech Stack
- **Backend:** NestJS, Kafka, Redis, PostgreSQL, Docker, Kubernetes (later)
- **Frontend (later):** React + TypeScript, TailwindCSS + shadcn/ui, Zustand (state), TanStack Query (data fetching) + TanStack Router
- **Cloud:** Azure (Container Apps → AKS, Event Hubs, Azure DB for PostgreSQL, Azure Cache for Redis)

## Developer Skill Level
- Comfortable with JS/TS basics, Node.js, Express, REST APIs, basic Docker
- New to: NestJS, Kafka, Redis, Kubernetes, microservices, production system design

## Coaching Style
- Ask clarifying questions before suggesting solutions
- Explain WHY behind every decision
- Small achievable tasks, not full implementations
- Point to official docs and resources
- Challenge assumptions, explain trade-offs

---

## Current Phase: Phase 1 - Implementation
**Status:** Milestone 6 complete, starting Milestone 7

---

## Architecture Decisions Log

### ADR-001: Monolith-first
- Start with a well-structured NestJS monolith using modules as service boundaries
- Extract to microservices later when complexity justifies it
- Rationale: reduces infrastructure overhead while learning, modules map cleanly to future services

### ADR-002: Gradual technology adoption
- MVP uses only NestJS + PostgreSQL
- Redis introduced in Milestone 4 (for BullMQ retry queues)
- Kafka deferred until post-MVP (when we need true event streaming)
- Rationale: learn each tool when you actually need it, not before

### ADR-003: API-only MVP
- No frontend UI in MVP, API + tools like Postman/curl for testing
- Frontend (React + TailwindCSS + shadcn/ui) comes in a later phase

### ADR-004: Destination http_method
- Keep `http_method` column on destinations, default to POST
- Don't build selection logic yet — just use the stored value when forwarding
- Rationale: minimal cost to keep, avoids schema migration later

### ADR-005: Destination headers
- Essential even for MVP — destinations need auth headers, content types, etc.

### ADR-006: Flat routes for destinations
- Destinations use flat routes (`/destinations`) instead of nested (`/endpoints/:id/destinations`)
- List endpoint requires `endpointId` query param — no unfiltered listing
- Rationale: better separation of concerns, cleaner module boundaries, easier future extraction

### ADR-007: 422 for invalid foreign key references
- When creating/updating a destination with a non-existent `endpointId`, return 422 Unprocessable Entity (not 404)
- 404 is reserved for when the primary resource in the URL path isn't found
- 422 signals "your request body has a problem" — more debuggable for API consumers

### ADR-008: Destinations can be moved between endpoints
- `endpointId` is updatable via PATCH — allows reassigning a destination to a different endpoint
- Update validates the new endpoint exists before saving

### ADR-009: BullMQ over RabbitMQ for job queue
- BullMQ chosen for retry/delivery jobs — built-in retries, backoff, NestJS integration
- RabbitMQ deferred — overkill for single-service job processing, adds AMQP complexity
- Redis serves as BullMQ backend (also useful for future caching)

### ADR-010: One job per event-destination pair
- Each delivery is a separate BullMQ job with its own retry lifecycle
- Allows granular retries — failed destination X retries independently of successful destination Y
- Job payload carries full event + destination data (option A: no DB fetch in worker, data captured at queue time)

### ADR-011: Single DeliveryModule for producer + consumer
- Producer (DeliveryService) and consumer (DeliveryProcessor) in same module
- Both are part of the "delivery" concern — splitting would separate related logic
- DeliveryService is the public interface; queue internals are implementation details

---

### ADR-012: Kafka + BullMQ coexistence
- Kafka handles event streaming (ingestion → fan-out to consumers, partitioning, consumer groups)
- BullMQ handles per-destination delivery retries (exponential backoff, attempt tracking, failure handling)
- Considered replacing BullMQ entirely with Kafka retry topics, but Kafka lacks native delayed delivery — would require building delay mechanisms that BullMQ already provides
- Redis stays as BullMQ backend (and future caching/rate limiting)
- Rationale: each tool does what it's best at, avoids reinventing retry logic

---

## Coaching Notes
- Developer is new to how webhooks work in practice — explain business logic, real-world patterns, and what webhook senders actually do (signatures, retries, idempotency keys, etc.) as we encounter them
- Guide through NestJS patterns (modules, services, controllers, DTOs, pipes) as they come up
- Developer uses VS Code with GitHub Copilot — remind to review suggestions critically, especially validation decorators and HTTP status codes

## Resume Point
**Next task:** Milestone 7 — Containerization & Azure Deployment

Key context:
- Milestones 1-6 complete — full MVP + Kafka event streaming pipeline
- 66 unit tests across all services, DeliveryProcessor, KafkaProducer, KafkaConsumer (8 suites)
- Kafka pipeline: Producer publishes to `webhook-events` topic (3 partitions, keyed by endpointId), Consumer processes and forwards to DeliveryService
- Kafka + BullMQ coexist: Kafka handles event streaming/fan-out, BullMQ handles per-destination retries with backoff (ADR-012)
- Dead letter topic (`webhook-events-dlq`): consumer retries 3 times, then sends failed messages to DLQ with error context
- Consumer never blocks partitions — all errors handled gracefully with DLQ fallback
- E2e testing deferred to Milestone 13

---

## Data Model (MVP)

### endpoints
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, auto-generated |
| slug | VARCHAR | unique, not null |
| name | VARCHAR | not null |
| description | VARCHAR | nullable |
| isActive | BOOLEAN | default: true |
| createdAt | TIMESTAMP | auto |
| updatedAt | TIMESTAMP | auto |

**Relationships:** 1 → N Destinations, 1 → N Events

### destinations
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, auto-generated |
| endpointId | UUID | FK → endpoints.id |
| url | VARCHAR | not null |
| httpMethod | VARCHAR | default: 'POST' |
| headers | JSON | not null |
| isActive | BOOLEAN | default: true |
| createdAt | TIMESTAMP | auto |
| updatedAt | TIMESTAMP | auto |

**Relationships:** N → 1 Endpoint, 1 → N DeliveryAttempts

### events
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, auto-generated |
| endpointId | UUID | FK → endpoints.id |
| method | VARCHAR | not null (HTTP method from sender) |
| headers | JSON | not null (raw incoming headers) |
| body | JSON | nullable (the webhook payload) |
| queryParams | JSON | nullable (query string if any) |
| sourceIp | VARCHAR | nullable (sender's IP for debugging) |
| receivedAt | TIMESTAMP | auto |

**Relationships:** N → 1 Endpoint, 1 → N DeliveryAttempts
**Note:** Events are immutable — no updatedAt. Once received, they never change.

### delivery_attempts
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, auto-generated |
| eventId | UUID | FK → events.id |
| destinationId | UUID | FK → destinations.id |
| status | ENUM | 'pending', 'success', 'failed' — default: 'pending' |
| attemptNumber | INTEGER | default: 1 |
| requestHeaders | JSON | nullable (what was sent to destination) |
| requestBody | JSON | nullable (what was sent — may differ with future transformations) |
| responseStatusCode | INTEGER | nullable |
| responseBody | TEXT | nullable (truncated response for debugging) |
| errorMessage | VARCHAR | nullable (if request failed, e.g. timeout) |
| attemptedAt | TIMESTAMP | auto |
| nextRetryAt | TIMESTAMP | nullable (when to retry, null if done) |

**Relationships:** N → 1 Event, N → 1 Destination

### Design rationale
- **Events & DeliveryAttempts are separate** — one event fans out to N destinations, each with its own lifecycle
- **requestHeaders/requestBody on DeliveryAttempt** — prepares for future payload transformations
- **nextRetryAt** — Milestone 4's retry system uses this to find failed deliveries to retry
- **queryParams & sourceIp** — cheap to store, valuable for debugging

---

## MVP Scope: "Receive, Store, Forward, Retry"

### In MVP
- Create endpoints (unique URL per webhook source)
- Receive & store raw webhook events
- Forward to 1+ destinations
- Basic retry with exponential backoff
- API to list/inspect received events
- Health check endpoint

### NOT in MVP
- Payload transformation
- Complex routing rules / filters
- Rate limiting & deduplication
- Analytics dashboard
- Authentication & multi-tenancy
- Kafka, Kubernetes

---

## Milestones

### Milestone 1: Foundation (Week 1) — COMPLETE
- [x] Project structure & dev environment (Docker Compose with Postgres)
- [x] Database schema design (4 entities: Endpoint, Destination, Event, DeliveryAttempt)
- [x] Path alias @/ configured (tsconfig paths + tsc-alias for build)
- [x] Entities registered in DatabaseModule with TypeOrmModule.forFeature() (refactored from EndpointsModule)
- [x] TypeORM migrations set up (data-source.ts + npm scripts)
- [x] First migration generated and run successfully
- [x] Endpoint CRUD (controller + service + DTOs with validation)
- [x] Global ValidationPipe with whitelist enabled
- [x] NotFoundException handling for missing resources

### Milestone 2: Core Ingestion (Week 2) — COMPLETE
- [x] Webhook receiver endpoint (`POST /webhooks/:slug`)
- [x] Store raw events in database
- [x] EventsModule with service/controller, wired into AppModule
- [x] IEvent interface for clean service boundary
- [x] Event listing API (`GET /endpoints/:slug/events`) with cursor-based pagination
- [x] GetEventsQueryDto with validation (limit, after cursor as UUID)
- [x] IEventResponse interface for paginated response shape
- [x] Refactored: DatabaseModule as shared entity registration (no circular deps)
- [x] Refactored: NotFoundException handling moved into services, controllers stay thin

### Milestone 3: Forwarding & Delivery (Week 2-3) — COMPLETE
- [x] Destination management (CRUD for where events get forwarded)
  - DestinationsModule with controller, service, DTOs (create, update, get-query)
  - HttpMethods enum for validation
  - Flat routes: POST/GET/GET:id/PATCH/DELETE on `/destinations`
  - `validateEndpoint()` helper — reused across create, list, and update
- [x] Synchronous forwarding to destinations
  - DeliveryModule with DeliveryService, uses NestJS HttpModule (@nestjs/axios)
  - `forwardEventToDestination()` loops through active destinations independently
  - Uses `firstValueFrom()` to convert HttpService Observables to Promises
  - Each destination gets its own try/catch — one failure doesn't block others
- [x] Delivery attempt logging (success/failure/status code)
  - Creates pending DeliveryAttempt before HTTP call, updates with result after
  - Success: logs responseStatusCode, responseBody
  - Failure: logs AxiosError details — statusCode (if available), errorMessage
  - Tested with httpbin.org/post (200 success) and httpbin.org/status/500 (failure)

### Milestone 4: Reliability (Week 3-4) — COMPLETE
- [x] Introduce Redis + BullMQ
  - Redis added to Docker Compose with persistent volume
  - BullModule.forRootAsync with ConfigService for Redis connection
  - Redis host/port configurable via environment variables
- [x] Retry logic with fixed backoff
  - 3 attempts total, 60s fixed delay between retries
  - BullMQ job config: `{ attempts: 3, backoff: { type: 'fixed', delay: 60000 } }`
  - Uses `job.attemptsMade` and `job.opts.attempts` for attempt tracking
- [x] Delivery status tracking (pending → success/failed)
  - DeliveryAttempt created as PENDING before queuing
  - Processor updates status to SUCCESS or FAILED after each attempt
  - attemptNumber tracked (1-based) on each retry
- [x] Dead letter handling (events that permanently fail)
  - After max attempts, status set to FAILED with full error details
  - errorMessage, responseStatusCode, responseBody all captured
- [x] Async delivery via job queue
  - DeliveryService (producer) queues one job per event-destination pair
  - DeliveryProcessor (consumer) extends WorkerHost, handles HTTP calls
  - Webhook response time ~25ms (vs waiting for all HTTP calls synchronously)

### Milestone 5: Developer Experience (Week 4-5) — COMPLETE
- [x] Event inspection API (`GET /events/:id` with delivery attempts)
- [x] Replay endpoint (`POST /delivery-attempts/:id/retry`)
- [x] Unit tests (52 tests across 6 suites — all services + DeliveryProcessor)
- [x] ParseUUIDPipe validation on all UUID route params
- [x] Stricter DTO validation (IsNotEmpty, default headers)


---

## Post-MVP Milestones

### Milestone 6: Event Streaming with Kafka — COMPLETE
**Learning goal:** Event-driven architecture, message brokers, async processing at scale
- [x] Local Kafka setup (Docker Compose)
  - Kafka 3.9.0 in KRaft mode (no Zookeeper), persistent volume
  - Admin client creates topics programmatically on startup
- [x] Producer: publish incoming webhooks to Kafka topic on ingestion
  - KafkaProducer service with sendMessage(topic, key, message)
  - EventsService publishes to `webhook-events` topic after DB save
  - endpointId used as message key for partition affinity
- [x] Consumer: consume from topic and forward to destinations
  - KafkaConsumer subscribes to `webhook-events`, calls DeliveryService
  - Consumer group `webhook-router-group` with RoundRobinAssigner
- [x] Learn partitioning, consumer groups, offsets, delivery guarantees
  - Tested 3 partitions with stripe/github/shopify endpoints
  - Verified consumer group rebalancing with 2 instances (partition redistribution)
  - Verified partition reclaim on instance failure
- [x] Kafka + BullMQ coexistence decided (ADR-012)
  - Kafka handles event streaming and fan-out
  - BullMQ handles per-destination retry lifecycle with backoff
- [x] Error handling & dead letter topics
  - `webhook-events-dlq` topic (1 partition) for failed messages
  - Consumer retries processing 3 times before sending to DLQ
  - Parse errors go straight to DLQ (no retry)
  - DLQ messages include: original event, error, source topic/partition/offset, attempt count, timestamp
  - Consumer never throws — all errors handled gracefully, offsets always advance
  - IDlqMessage interface for DLQ message shape

### Milestone 7: Containerization & Azure Deployment — NOT STARTED
**Learning goal:** Docker production builds, cloud services, managed infrastructure
- [ ] Production Dockerfile (multi-stage build)
- [ ] Azure Container Registry (ACR) — push images
- [ ] Azure Database for PostgreSQL — managed DB
- [ ] Azure Event Hubs — managed Kafka-compatible broker
- [ ] Azure Cache for Redis — managed Redis
- [ ] Azure Container Apps — deploy the application
- [ ] Environment config & secrets management (Azure Key Vault)
- [ ] CI/CD pipeline (GitHub Actions → build → push → deploy)

### Milestone 8: NestJS Best Practices Hardening — NOT STARTED
**Learning goal:** Production-grade patterns, error handling, observability basics
**Quick wins:**
- [ ] Graceful shutdown (`app.enableShutdownHooks()` in main.ts)
- [ ] Health check endpoint (`@nestjs/terminus` with DB + Redis checks)
- [ ] Structured logging (NestJS `Logger` in services)
**Deeper work:**
- [ ] Global exception filter for consistent error response format
- [ ] Transactions for multi-step operations (e.g. `createEvent`)
- [ ] Response serialization (DTOs for API responses, ClassSerializerInterceptor)
- [ ] Logging interceptor for cross-cutting request/response logging
- [ ] Event-driven decoupling (EventEmitter between services instead of direct calls)

### Milestone 9: Frontend — NOT STARTED
**Learning goal:** React + TypeScript, TailwindCSS + shadcn/ui, Zustand, TanStack Query + Router
- [ ] Project setup (Vite + React + TypeScript + TailwindCSS + shadcn/ui)
- [ ] TanStack Router setup (file-based routing)
- [ ] TanStack Query setup (API client, query keys, cache invalidation)
- [ ] Zustand stores (global UI state — not server state, that's TanStack Query's job)
- [ ] Endpoint management UI (list, create, edit, delete)
- [ ] Destination management UI
- [ ] Event log viewer with cursor-based pagination
- [ ] Delivery attempt details & status
- [ ] Real-time updates (polling via TanStack Query refetchInterval or WebSockets)

### Milestone 10: Smart Routing & Transformations — NOT STARTED
**Learning goal:** Rule engines, payload manipulation, webhook ecosystem patterns
- [ ] Webhook signature verification (HMAC — Stripe, GitHub, Shopify patterns)
- [ ] Routing rules — filter events by payload content before forwarding
- [ ] Payload transformation — map/reshape data before sending to destinations
- [ ] Header injection & dynamic headers per destination

### Milestone 11: Authentication & Multi-tenancy — NOT STARTED
**Learning goal:** Auth patterns, JWT, API keys, tenant isolation
- [ ] API key authentication for endpoint access
- [ ] User accounts & JWT-based auth for management API
- [ ] Workspace/tenant isolation — each tenant sees only their own data
- [ ] Role-based access control (admin vs viewer)

### Milestone 12: Production Hardening — NOT STARTED
**Learning goal:** Kubernetes, observability, operating production systems
- [ ] Migrate Kafka from raw kafkajs to `@nestjs/microservices` Kafka transport
- [ ] Migrate from Azure Container Apps to AKS (Azure Kubernetes Service)
- [ ] Horizontal scaling & autoscaling policies
- [ ] Structured logging (Pino or Winston)
- [ ] Metrics & monitoring (Prometheus + Grafana or Azure Monitor)
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Rate limiting & deduplication
- [ ] Health checks & readiness/liveness probes

### Milestone 13: E2E Testing — NOT STARTED
**Learning goal:** Integration testing, test database isolation, supertest
- [ ] Test database setup (separate `webhooks_test` DB)
- [ ] Shared e2e test helper (bootstrap, migration, cleanup between tests)
- [ ] Endpoint CRUD e2e tests
- [ ] Destination CRUD e2e tests
- [ ] Webhook ingestion + delivery flow e2e tests
- [ ] Event inspection + pagination e2e tests
