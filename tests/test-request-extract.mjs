/**
 * Test: requestExtract.ts
 *
 * Verifies extraction helpers for header precedence, token content,
 * authorization formatting, and UUID generation.
 *
 * Run: npx tsx tests/test-request-extract.mjs
 */

import assert from 'node:assert/strict'

const {
  extractUserIdFromRequest,
  extractUserId,
  extractUserNameFromRequest,
  extractUserEmailFromRequest,
  extractUserSessionState,
  extractUserTokenContent,
  extractUserToken,
  extractAuthorizationFromRequest,
  extractUserTokenFromRequest,
  extractRootOrgFromRequest,
  getUUID,
} = await import('../src/utils/requestExtract.ts')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ❌ ${name}`)
    console.error(`     ${err.message}`)
    failed++
  }
}

function makeReq({ headers = {}, tokenContent = {}, token = 'token-123' } = {}) {
  return {
    header: (name) => headers[name],
    kauth: {
      grant: {
        access_token: {
          token,
          content: {
            given_name: 'Jane',
            family_name: 'Doe',
            sub: 'org:user:user-001',
            name: 'Jane Doe',
            email: 'jane@example.com',
            preferred_username: 'jane.preferred@example.com',
            session_state: 'session-abc',
            ...tokenContent,
          },
        },
      },
    },
  }
}

console.log('requestExtract helper tests')

test('extractUserIdFromRequest prioritizes wid header', () => {
  const req = makeReq({ headers: { wid: 'wid-777' } })
  assert.equal(extractUserIdFromRequest(req), 'wid-777')
})

test('extractUserIdFromRequest falls back to token sub', () => {
  const req = makeReq()
  assert.equal(extractUserIdFromRequest(req), 'org:user:user-001')
})

test('extractUserId returns wid when present', () => {
  const req = makeReq({ headers: { wid: 'wid-900' } })
  assert.equal(extractUserId(req), 'wid-900')
})

test('extractUserId parses third segment from sub', () => {
  const req = makeReq({ tokenContent: { sub: 'realm:user:actual-user' } })
  assert.equal(extractUserId(req), 'actual-user')
})

test('extractUserNameFromRequest returns token name', () => {
  const req = makeReq({ tokenContent: { name: 'John Smith' } })
  assert.equal(extractUserNameFromRequest(req), 'John Smith')
})

test('extractUserEmailFromRequest returns email when available', () => {
  const req = makeReq({
    tokenContent: {
      email: 'primary@example.com',
      preferred_username: 'fallback@example.com',
    },
  })
  assert.equal(extractUserEmailFromRequest(req), 'primary@example.com')
})

test('extractUserEmailFromRequest falls back to preferred_username', () => {
  const req = makeReq({
    tokenContent: {
      email: undefined,
      preferred_username: 'fallback@example.com',
    },
  })
  assert.equal(extractUserEmailFromRequest(req), 'fallback@example.com')
})

test('extractUserSessionState returns session_state', () => {
  const req = makeReq({ tokenContent: { session_state: 'session-999' } })
  assert.equal(extractUserSessionState(req), 'session-999')
})

test('extractUserTokenContent returns the token content object', () => {
  const req = makeReq({ tokenContent: { sub: 'a:b:c' } })
  const content = extractUserTokenContent(req)
  assert.equal(typeof content, 'object')
  assert.equal(content.sub, 'a:b:c')
})

test('extractUserToken returns access token', () => {
  const req = makeReq({ token: 'jwt-xyz' })
  assert.equal(extractUserToken(req), 'jwt-xyz')
})

test('extractAuthorizationFromRequest prefixes Bearer', () => {
  const req = makeReq({ token: 'jwt-token' })
  assert.equal(extractAuthorizationFromRequest(req), 'Bearer jwt-token')
})

test('extractUserTokenFromRequest reads canonical token header', () => {
  const req = makeReq({ headers: { 'X-Authenticated-User-Token': 'header-token-1' } })
  assert.equal(extractUserTokenFromRequest(req), 'header-token-1')
})

test('extractUserTokenFromRequest supports lowercase header fallback', () => {
  const req = makeReq({ headers: { 'x-authenticated-user-token': 'header-token-2' } })
  assert.equal(extractUserTokenFromRequest(req), 'header-token-2')
})

test('extractRootOrgFromRequest returns rootorg header', () => {
  const req = makeReq({ headers: { rootorg: 'dept-root' } })
  assert.equal(extractRootOrgFromRequest(req), 'dept-root')
})

test('getUUID returns a valid v1 UUID and differs across calls', () => {
  const id1 = getUUID()
  const id2 = getUUID()
  const uuidV1Like = /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  assert.ok(uuidV1Like.test(id1), `Expected UUID v1 format, got ${id1}`)
  assert.ok(uuidV1Like.test(id2), `Expected UUID v1 format, got ${id2}`)
  assert.notEqual(id1, id2, 'UUIDs should be unique across calls')
})

console.log(`\n${'─'.repeat(50)}`)
console.log(`${passed} passed, ${failed} failed`)

if (failed > 0) {
  console.log('❌ FAIL')
  process.exit(1)
} else {
  console.log('✅ ALL PASS')
  process.exit(0)
}
