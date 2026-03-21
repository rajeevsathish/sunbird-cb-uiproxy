# API HTTP Client Consolidation Plan

Date: 2026-03-21
Repo: sunbird-cb-uiproxy
Scope: Consolidate API HTTP usage and remove legacy request usage safely.

## Objective

Standardize HTTP usage across APIs to:
- axios for service-to-service API requests
- http-proxy for transparent pass-through proxying
- remove request after safe migration

## Why this is needed

The repo currently uses 3 patterns:
- axios: async API calls and response handling
- http-proxy: streaming gateway pass-through
- request: legacy callback/stream usage

This increases maintenance overhead, typing inconsistency, and migration risk.

## Phase 0: Inventory (1 day)

1. Identify all request imports and callsites.
2. Classify each callsite into:
- JSON API call
- stream/pipe passthrough
- callback side-effect call
3. Map each to target replacement:
- axios for JSON/callback flows
- http-proxy or stream-safe replacement for passthrough

Deliverable:
- migration inventory table (file, route, current style, target style, risk)

## Phase 1: Standards and Guardrails (0.5 day)

1. Add short coding standard:
- use axios for API calls
- use http-proxy only for transparent proxying
- no new request imports
2. Add CI/PR guard to fail if new request import is introduced.

Deliverable:
- standards note + CI guard rule

## Phase 2: Low-risk migration (2-3 days)

Migrate request callsites that are non-streaming and straightforward.

Candidate modules:
- src/publicApi_v8/keycloakHelper.ts
- src/utils/permissionHelper.ts
- src/utils/keycloak-user-creation.ts

Rules:
1. Preserve headers, auth, timeout, and response code behavior.
2. Keep error mapping unchanged.
3. Keep current logger behavior (only client replacement).

Deliverable:
- PR wave 1 with unit/smoke validation

## Phase 3: Stream-sensitive migration (2-4 days)

Review request usages using .pipe or stream callbacks.

Candidate module:
- src/protectedApi_v8/content.ts

Rules:
1. For true passthrough, prefer proxy/stream-safe approach.
2. Validate content-type/content-length and body behavior.
3. Validate binary and large payload handling.

Deliverable:
- PR wave 2 + stream contract test notes

## Phase 4: Verification (1-2 days)

1. Route regression test checklist:
- status codes
- response body
- headers
- auth/session behavior
2. Non-functional checks:
- p95 latency
- CPU and memory
- error rate (4xx/5xx)

Deliverable:
- before/after validation report

## Phase 5: Remove legacy dependency (0.5 day)

1. Confirm zero runtime imports of request.
2. Remove dependencies:
- request
- @types/request
3. Run build + smoke tests.

Deliverable:
- cleanup PR

## Rollout Strategy

1. Ship in small PR waves.
2. Canary deploy each wave.
3. Keep rollback point/tag per wave.

## Acceptance Criteria

1. Zero request imports in src.
2. request and @types/request removed from package.json.
3. No API contract regression on migrated routes.
4. p95 and error rate stable or improved.

## Suggested Tracking Fields (for Jira/Sheet)

- Task ID
- File/Route
- Current pattern
- Target pattern
- Risk (L/M/H)
- Owner
- ETA
- Status
- Test evidence link
