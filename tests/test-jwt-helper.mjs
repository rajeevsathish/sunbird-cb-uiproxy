import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'

import envModule from '../src/utils/env.ts'
import jwtHelperModule from '../src/utils/jwtHelper.ts'

const { CONSTANTS } = envModule
const { decodeCode, getCurrnetExpiryTime, getExpiryTime } = jwtHelperModule

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

console.log('jwtHelper tests')

test('getExpiryTime returns 0 for future-expiring token', () => {
  const token = jwt.sign({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 120 }, 'secret')
  assert.equal(getExpiryTime(token), 0)
})

test('getExpiryTime returns positive elapsed seconds for expired token', () => {
  const token = jwt.sign({ sub: 'user-2', exp: Math.floor(Date.now() / 1000) - 30 }, 'secret')
  assert.ok(getExpiryTime(token) >= 1)
})

test('getCurrnetExpiryTime returns exp in milliseconds when present', () => {
  const exp = Math.floor(Date.now() / 1000) + 300
  const token = jwt.sign({ sub: 'user-3', exp }, 'secret')
  assert.equal(getCurrnetExpiryTime(token), exp * 1000)
})

test('getCurrnetExpiryTime falls back to KEYCLOAK_SESSION_TTL without exp', () => {
  const token = jwt.sign({ sub: 'user-4' }, 'secret', { noTimestamp: true })
  assert.equal(getCurrnetExpiryTime(token), CONSTANTS.KEYCLOAK_SESSION_TTL)
})

test('decodeCode returns decoded payload', () => {
  const token = jwt.sign({ sub: 'user-5', role: 'PUBLIC' }, 'secret')
  const decoded = decodeCode(token)
  assert.equal(decoded.sub, 'user-5')
  assert.equal(decoded.role, 'PUBLIC')
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