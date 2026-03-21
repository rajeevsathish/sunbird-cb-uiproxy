# Sunbird UI Proxy - Analysis Sheet

Date: 2026-03-21
Repository: sunbird-cb-uiproxy
Goal: Explain current quality/performance issues and provide a concrete optimization plan without changing code.

## 1) Executive Summary 

- Current pod demand (24 pods for ~5K TPS) is plausible for this architecture.
- Primary bottlenecks are request-path middleware overhead, high logging volume, downstream call fan-out, and old runtime/container stack.
- Security hygiene is a top priority due to hardcoded credentials and tokens in source.
- A phased optimization can reduce CPU per request, improve p95 latency, and likely reduce required pod count.

## 2) Key Evidence Collected

### Runtime and process model
- Cluster worker count defaults to 1 thread unless env overrides CLUSTER_THREAD.
- Files:
  - src/index.ts (cluster fork logic)
  - src/utils/env.ts (CLUSTER_THREAD default)

### Request path overhead
- Global middleware chain includes session + whitelist logger + whitelist validator.
- Files:
  - src/server.ts (expressSession, apiWhiteListLogger, isAllowed)
  - src/configs/session.config.ts (Cassandra-backed session store)

### Logging intensity
- Duplicate request logging middleware plus many manual logs in hot paths.
- Two morgan middlewares active in server.ts.
- High log surface in proxy and whitelist code.

### Dependency fan-out
- Service acts as proxy/aggregation layer to many downstream systems.
- High number of outbound call/proxy call sites.
- Sample routes aggregate multiple upstream calls (for example profile route does Promise.all).

### Timeout and payload settings
- connect-timeout set to 240s.
- request body JSON limit set to 50mb.
- These settings can increase memory usage and long-lived in-flight requests during spikes.

### Codebase maintainability hotspots
- Very large central files:
  - src/utils/whitelistApis.ts: 8227 lines
  - src/utils/apiWhiteList.ts: 394 lines
  - src/utils/proxyCreator.ts: 384 lines
  - src/server.ts: 215 lines

### Platform drift
- Docker images run node:12 while package engine expects >=14.19.
- This likely impacts performance/security posture.

## 3) High-Risk Findings (Prioritized)

### Critical
1. Hardcoded credentials/tokens in source config.
   - Risk: secret leakage, compliance violation, operational blast radius.
2. Old runtime image (node:12) with platform mismatch.
   - Risk: CVEs, unstable dependency compatibility, lower performance.

### High
3. Global middleware cost on almost all protected requests.
   - Session + whitelist checks + auth path work adds latency per request.
4. Excessive request-path logging.
   - CPU and I/O overhead at scale; log ingestion costs also rise.
5. Per-request regex compilation/matching in whitelist path.
   - avoidable CPU burn under load.

### Medium
6. Very large policy file architecture (whitelistApis.ts).
   - Hard to maintain/test; high regression probability.
7. Potential reliability bug candidates in proxy path (example typo patterns and mutable values).
   - Can cause intermittent behavior under production traffic.

## 4) Why 24 Pods for 5K TPS Can Happen Here

Approximate math:
- 5000 TPS / 24 pods ~= 208 RPS per pod.

For a Node.js gateway with:
- auth/session checks,
- whitelist/pattern checks,
- high logging,
- heavy downstream proxying,

~200 RPS/pod is realistic when p95 latency is governed by downstream dependency response time and middleware CPU overhead.

## 5) Optimization Plan (No-Code Plan)

## Phase 0 - Baseline and observability (2-3 days)
1. Define SLOs (p50/p95/p99 latency, error rate, saturation).
2. Add route-level dashboards split by: public, protected, proxies.
3. Track dependency latency matrix (downstream service wise).
4. Add log-volume metric per endpoint.

Exit criteria:
- Top 10 slow endpoints known with dependency attribution.
- CPU, memory, and request latency baseline captured.

## Phase 1 - Security and runtime hygiene (3-5 days)
1. Remove all hardcoded secrets from code and move to secure secret management.
2. Rotate exposed keys/tokens immediately.
3. Upgrade runtime images to supported Node LTS and align with package engine.
4. Add CI checks: secret scanning, dependency CVE scan, image CVE scan.

Exit criteria:
- Zero plaintext credentials in repository.
- Zero critical vulnerabilities in CI gate.

## Phase 2 - Quick throughput wins (4-7 days)
1. Reduce hot-path log verbosity in production.
2. Keep a single request logger format (remove duplicate access logging).
3. Precompile route patterns at startup instead of matching strategy that recompiles during requests.
4. Keep static/public routes on a fast path with minimal middleware.
5. Revisit timeout and payload limits by endpoint class.

Exit criteria:
- 20-35% CPU reduction at same load.
- p95 latency reduction on protected/proxy routes.

## Phase 3 - Auth/session/whitelist efficiency (1-2 weeks)
1. Profile auth and session calls end-to-end.
2. Reduce mandatory session-store access for routes that can be token-only.
3. Split whitelist flow into:
   - fast allow/deny precheck,
   - deeper checks only for selected routes.
4. Add cache for static policy lookups.

Exit criteria:
- measurable drop in auth/whitelist time contribution.
- improved RPS per pod.

## Phase 4 - Outbound dependency and proxy hardening (1-2 weeks)
1. Standardize outbound HTTP clients with keep-alive and connection pooling.
2. Apply endpoint-specific retry/timeout strategy and circuit breaker policies.
3. Add short-TTL caching for high-read metadata endpoints.
4. Add bulkheads/rate-guards per downstream service.

Exit criteria:
- fewer timeout cascades.
- improved tail latency during downstream slowness.

## Phase 5 - Maintainability refactor (parallel, 2-4 weeks)
1. Decompose whitelistApis.ts into domain modules.
2. Separate matcher, policy, and response logic in apiWhiteList.ts.
3. Split proxyCreator.ts by route family.
4. Replace broad any usage with typed contracts gradually.
5. Add focused tests for whitelist and proxy behavior.

Exit criteria:
- reduced file complexity and clearer ownership.
- lower regression rate in release cycle.

## Phase 6 - Load validation and rollout (1 week)
1. Repeat load test baseline vs optimized build.
2. Compute new pod requirement for target TPS.
3. Roll out with canary + rollback thresholds.

Exit criteria:
- demonstrated increase in effective RPS per pod.
- stable error budget after rollout.

## 6) Suggested Backlog (Priority Order)

P0
1. Secret migration + key rotation.
2. Runtime upgrade plan and compatibility test.
3. Logging reduction strategy for production.

P1
4. Whitelist pattern precompilation and fast-path design.
5. Auth/session path profiling and optimization.
6. Outbound client pooling and timeout policy standardization.

P2
7. Refactor giant whitelist policy file into modules.
8. Type safety and lint debt reduction.
9. Test suite expansion around high-traffic middleware and proxy flows.

## 7) KPI Targets

- Throughput target: +30% to +60% RPS per pod after phases 2-4.
- Latency target: p95 down by 25%+ for protected/proxy traffic.
- Stability target: 50% fewer 5xx during dependency degradation tests.
- Operability target: 40% lower log volume per request.

## 8) Risks and Dependencies

- Runtime upgrade may require package compatibility fixes.
- Secret rotation must be coordinated with all dependent systems.
- Session/auth redesign requires security team sign-off.
- Load-test environment must represent production dependency latency profile.

## 9) Ownership Model (Recommended)

- Platform Team: runtime, container, CI security gates.
- Backend Team: middleware, whitelist, proxy, client pooling.
- SRE Team: observability, load testing, canary rollout.
- Security Team: secret migration and auth policy approvals.

## 10) Immediate Next Actions (This Week)

1. Freeze baseline metrics and define pass/fail thresholds.
2. Start secret migration and key rotation.
3. Start logging reduction proposal and approval.
4. Create PoC for whitelist precompiled matcher path.
5. Run first controlled load test and capture baseline report.
