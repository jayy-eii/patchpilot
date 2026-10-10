import { RepairRecommendation, ServiceNode } from '../types';

export class RecommendationEngine {
  private static readonly RECOMMENDATION_CATALOG: Record<string, Omit<RepairRecommendation, 'id' | 'serviceId' | 'serviceName'>[]> = {
    'payment-service': [
      {
        title: 'Implement Exponential Backoff & Idempotency Key Guarantees',
        problem: 'Upstream Order Service may duplicate charge attempts when network timeouts occur during checkout authorization.',
        proposedMitigation: 'Add deterministic idempotency keys (`Idempotency-Key: UUIDv4`) to all authorization endpoints. Wrap outbound PSP calls with jittered exponential backoff (initial: 200ms, factor: 2.0, max retries: 3).',
        whyItHelps: 'Prevents double-charging customers while safely retrying transient provider latency or 503 gateway drops.',
        priority: 'P0-CRITICAL',
        verificationStatus: 'PROPOSED' as any,
        tags: ['Resilience', 'FinTech', 'Idempotency'],
        implementationSnippet: `// Order -> Payment Client Resilience Config
const paymentClient = axios.create({
  baseURL: process.env.PAYMENT_SERVICE_URL,
  timeout: 3500, // Strict timeout under gateway SLA
  headers: {
    'Idempotency-Key': order.transactionId,
    'X-Client-Retry-Count': retryAttempt,
  }
});`,
      },
      {
        title: 'Introduce Circuit Breaker with "Pending Payment" Fallback State',
        problem: 'Synchronous payment failures immediately cause the entire checkout user journey to crash with 500 Internal Error.',
        proposedMitigation: 'Deploy a Circuit Breaker (open threshold: 40% errors over 10s). When OPEN, transition the checkout order into "PAYMENT_PENDING_ASYNC" state and queue for background capture.',
        whyItHelps: 'Decouples user cart completion from third-party payment gateway uptime. Users receive confirmation and payment is captured asynchronously.',
        priority: 'P1-HIGH',
        verificationStatus: 'PROPOSED' as any,
        tags: ['Circuit Breaker', 'UX Graceful Degradation'],
        implementationSnippet: `const breaker = new CircuitBreaker(executePayment, {
  timeout: 3000,
  errorThresholdPercentage: 40,
  resetTimeout: 15000,
});
breaker.fallback(() => queuePendingPaymentVerification(order));`,
      },
      {
        title: 'Decouple Receipt Notifications to Dead-Letter Queue (DLQ)',
        problem: 'Notification Service sync webhooks fail if payment events are dropped or timeout.',
        proposedMitigation: 'Publish payment authorization events to an AMQP/Kafka topic with transactional outbox pattern instead of synchronous webhooks.',
        whyItHelps: 'Guarantees at-least-once delivery of customer receipts without blocking Payment Service worker threads.',
        priority: 'P2-MEDIUM',
        verificationStatus: 'PROPOSED' as any,
        tags: ['Outbox Pattern', 'Asynchronous'],
      },
    ],

    'database': [
      {
        title: 'Harden Connection Pooling & Enforce Strict Statement Timeouts',
        problem: 'Cascading connection pool starvation across Auth, Order, and Inventory services leads to complete server thread lockup.',
        proposedMitigation: 'Configure PgBouncer / HikariCP pool limits: max 50 connections per pod, `statement_timeout = 3000ms`, `idle_in_transaction_session_timeout = 5000ms`.',
        whyItHelps: 'Prevents runaway slow queries from exhausting database sockets and protects replication followers.',
        priority: 'P0-CRITICAL',
        verificationStatus: 'PROPOSED' as any,
        tags: ['PostgreSQL', 'Infra', 'Pool Exhaustion'],
        implementationSnippet: `[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 5.0
server_idle_timeout = 600.0`,
      },
      {
        title: 'Activate Read-Replica Routing for Non-Mutation Queries',
        problem: 'Primary database write node experiences CPU throttling under high concurrent query loads.',
        proposedMitigation: 'Direct read-only catalog queries, inventory lookups, and session token checks to secondary read replicas via HAProxy/RDS reader endpoints.',
        whyItHelps: 'Reduces primary node utilization by 65%, isolating write transactions during sudden traffic spikes.',
        priority: 'P1-HIGH',
        verificationStatus: 'PROPOSED' as any,
        tags: ['High Availability', 'Replication'],
      },
      {
        title: 'Execute Automated Multi-AZ Failover Health Checks',
        problem: 'Unverified failover automation can lead to split-brain scenarios or prolonged multi-hour outages.',
        proposedMitigation: 'Verify automated Patroni/RDS multi-AZ heartbeat detection with synchronous replication guarantees and automatic DNS CNAME flipping within 30 seconds.',
        whyItHelps: 'Limits recovery time objective (RTO) to < 45 seconds without data loss (RPO = 0).',
        priority: 'P1-HIGH',
        verificationStatus: 'PROPOSED' as any,
        tags: ['Disaster Recovery', 'RTO/RPO'],
      },
    ],

    'notification-service': [
      {
        title: 'Adopt Queue-Based Buffered Processing with Retry Delays',
        problem: 'Downstream SMS/Email delivery provider (e.g. SendGrid, Twilio) experiences 429 Too Many Requests or regional latency.',
        proposedMitigation: 'Buffer all outgoing notifications into BullMQ/RabbitMQ with rate-limited consumer workers and exponential backoff.',
        whyItHelps: 'Since notifications are asynchronous by design, buffering isolates customer communications from third-party vendor downtime.',
        priority: 'P2-MEDIUM',
        verificationStatus: 'PROPOSED' as any,
        tags: ['Message Queue', 'Leaf Isolation'],
        implementationSnippet: `const notificationQueue = new Queue('customer-alerts', {
  limiter: {
    max: 100, // 100 messages per second rate-limit
    duration: 1000,
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
  }
});`,
      },
      {
        title: 'Implement Multi-Provider Fallback Routing',
        problem: 'Single-vendor dependency causes 100% notification drop during provider outages.',
        proposedMitigation: 'Configure secondary email/SMS provider fallback (e.g., fallback to AWS SES when SendGrid error rate exceeds 5%).',
        whyItHelps: 'Ensures transactional security codes and critical receipts deliver without manual operator intervention.',
        priority: 'P3-LOW',
        verificationStatus: 'PROPOSED' as any,
        tags: ['Redundancy', 'Vendor Agnostic'],
      },
    ],

    'auth-service': [
      {
        title: 'Enable Short-Lived Local JWT Verification with JWKS Caching',
        problem: 'API Gateway makes synchronous RPC calls to Auth Service for every single request, multiplying latency.',
        proposedMitigation: 'Transition from opaque stateful tokens to asymmetric RS256 JWTs. Allow API Gateway to cache JWKS public keys in memory for 15 minutes and verify signatures locally.',
        whyItHelps: 'Eliminates 90% of inter-service auth calls; API Gateway can authenticate requests even if Auth Service is temporarily unresponsive.',
        priority: 'P0-CRITICAL',
        verificationStatus: 'PROPOSED' as any,
        tags: ['Zero-Trust', 'JWT', 'Edge Auth'],
        implementationSnippet: `// API Gateway Ingress JWT validation
const jwksRsa = require('jwks-rsa');
const client = jwksRsa({
  jwksUri: 'https://auth-service/internal/.well-known/jwks.json',
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 900000 // 15 mins cache
});`,
      },
      {
        title: 'Deploy Distributed Redis Cache for Session Invalidation & Revocation',
        problem: 'Direct PostgreSQL hits for every token lookup create an avoidable bottleneck.',
        proposedMitigation: 'Store active session revocation blocklists in clustered Redis with TTL expiration.',
        whyItHelps: 'Reduces database load by 80% while preserving sub-millisecond token invalidation capability.',
        priority: 'P1-HIGH',
        verificationStatus: 'PROPOSED' as any,
        tags: ['Caching', 'Redis'],
      },
    ],

    'inventory-service': [
      {
        title: 'Implement Soft Stock Reservations with Two-Phase Confirmations',
        problem: 'Synchronous inventory database locks during checkout cause lock contention and timeouts under flash sales.',
        proposedMitigation: 'Use Redis-backed expiring reservation keys (TTL: 10 minutes) during cart checkout, confirming permanent DB stock deduction only upon successful payment event.',
        whyItHelps: 'Prevents row-level database lock serialization and handles order cancellations cleanly.',
        priority: 'P1-HIGH',
        verificationStatus: 'PROPOSED' as any,
        tags: ['Inventory Locks', 'Concurrency'],
      },
      {
        title: 'Asynchronous Inventory Reconciliation Reconciliation Worker',
        problem: 'Drift between physical warehouse stock and reservation counters.',
        proposedMitigation: 'Run periodic scheduled reconciliation jobs every 30 minutes to verify inventory ledger sums against actual physical stock levels.',
        whyItHelps: 'Catches phantom allocations without impacting real-time checkout throughput.',
        priority: 'P2-MEDIUM',
        verificationStatus: 'PROPOSED' as any,
        tags: ['Reconciliation', 'Auditing'],
      },
    ],

    'order-service': [
      {
        title: 'Apply Saga Pattern with Compensating Transactions for Checkout Workflow',
        problem: 'Distributed failures across Payment, Inventory, and Order leave system in inconsistent partial states.',
        proposedMitigation: 'Implement an orchestrated Saga state machine. If payment succeeds but inventory lock fails, automatically trigger compensation refund workflow.',
        whyItHelps: 'Eliminates partial cart charges and maintains eventual consistency across distributed domains.',
        priority: 'P0-CRITICAL',
        verificationStatus: 'PROPOSED' as any,
        tags: ['Saga Pattern', 'Distributed Transactions'],
      },
      {
        title: 'Client-Side Graceful Retry Headers & Stale Caching',
        problem: 'Transient 503 drops force users to re-submit orders manually, creating order dupes.',
        proposedMitigation: 'Return `Retry-After: 3` and cache order summary idempotency hashes on edge gateway proxies.',
        whyItHelps: 'Allows client web/mobile SDKs to smoothly poll order completion without bursting database connections.',
        priority: 'P2-MEDIUM',
        verificationStatus: 'PROPOSED' as any,
        tags: ['HTTP Spec', 'Client Resilience'],
      },
    ],

    'api-gateway': [
      {
        title: 'Configure Adaptive Ingress Rate-Limiting & Shedding',
        problem: 'Cascading downstream microservice delays cause gateway worker pool exhaustion and 504 Gateway Timeouts.',
        proposedMitigation: 'Implement token-bucket rate limiting per IP and client API key. Enable CoDel / concurrency-based load shedding when average downstream latency exceeds 400ms.',
        whyItHelps: 'Protects healthy services from being overwhelmed by retries during partial outages, keeping unaffected endpoints responsive.',
        priority: 'P0-CRITICAL',
        verificationStatus: 'PROPOSED' as any,
        tags: ['Load Shedding', 'Rate Limiting', 'Traffic Management'],
      },
      {
        title: 'Health-Check Active Probing & Dynamic Upstream Circuit Breaking',
        problem: 'Gateway continues forwarding traffic to dead service instances until TCP socket times out.',
        proposedMitigation: 'Configure Envoy/Nginx active HTTP health checks (`interval: 2s, timeout: 500ms, unhealthy_threshold: 2`). Automatically eject failing pod instances from upstream pools.',
        whyItHelps: 'Prevents end-user requests from hanging on dead backend sockets.',
        priority: 'P1-HIGH',
        verificationStatus: 'PROPOSED' as any,
        tags: ['Envoy', 'Health Checks'],
      },
    ],
  };

  /**
   * Generates deterministic repair recommendations based on the selected failed service
   */
  public static getRecommendationsForService(service: ServiceNode): RepairRecommendation[] {
    const rawRecommendations = this.RECOMMENDATION_CATALOG[service.id] || [
      {
        title: `Generic Resilience Hardening for ${service.name}`,
        problem: `Service experienced a critical fault which propagated to dependent consumers.`,
        proposedMitigation: `Audit network timeout budgets, implement circuit breakers, and enforce graceful fallback responses.`,
        whyItHelps: `Isolates service failures and prevents cascading crash loops.`,
        priority: 'P1-HIGH',
        verificationStatus: 'PROPOSED' as any,
        tags: ['Resilience', 'General'],
      },
    ];

    return rawRecommendations.map((rec, index) => ({
      id: `REC-${service.id.toUpperCase()}-${index + 1}`,
      serviceId: service.id,
      serviceName: service.name,
      title: rec.title,
      problem: rec.problem,
      proposedMitigation: rec.proposedMitigation,
      whyItHelps: rec.whyItHelps,
      priority: rec.priority,
      verificationStatus: 'PROPOSED' as any,
      implementationSnippet: rec.implementationSnippet,
      tags: rec.tags,
    }));
  }

  public static getMitigationSummarySteps(service: ServiceNode): string[] {
    const recs = this.getRecommendationsForService(service);
    return recs.map(r => `${r.title}: ${r.proposedMitigation}`);
  }
}
