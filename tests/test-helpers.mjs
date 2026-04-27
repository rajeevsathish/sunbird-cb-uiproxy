/**
 * Test: helpers.ts
 *
 * Verifies core utility behavior for range/query formatting,
 * date-range formatting, auth encoding, and regex validation.
 *
 * Run: npx tsx tests/test-helpers.mjs
 */

import assert from 'node:assert/strict'

const {
  esBasicAuth,
  getDateRangeString,
  getEmailLocalPart,
  getStringifiedQueryParams,
  range,
  validateInputWithRegex,
} = await import('../src/utils/helpers.ts')

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ❌ ${name}`)
    console.error(`     ${err.message}`)
    failed++
  }
}

console.log('helpers utility tests')

await test('range yields expected values with default step', () => {
  assert.deepEqual([...range(5)], [0, 1, 2, 3, 4])
})

await test('range yields expected values with custom step', () => {
  assert.deepEqual([...range(7, 2)], [0, 2, 4, 6])
})

await test('getStringifiedQueryParams includes only truthy values', () => {
  const out = getStringifiedQueryParams({ a: 'x', b: 0, c: 2, d: '', e: undefined })
  assert.equal(out, 'a=x&c=2')
})

await test('esBasicAuth returns valid base64 basic auth payload', () => {
  const decoded = Buffer.from(esBasicAuth(), 'base64').toString('utf8')
  assert.equal(decoded.includes(':'), true)
})

await test('getEmailLocalPart extracts part before @', () => {
  assert.equal(getEmailLocalPart('user@example.com'), 'user')
})

await test('getEmailLocalPart returns input when no @ exists', () => {
  assert.equal(getEmailLocalPart('plainuserid'), 'plainuserid')
})

await test('getDateRangeString returns a single-date format for same date', () => {
  const out = getDateRangeString('2026-04-21', '2026-04-21')
  assert.equal(typeof out, 'string')
  assert.equal(out.includes('Apr'), true)
  assert.equal(out.includes('2026'), true)
})

await test('getDateRangeString returns cross-year concise range', () => {
  const out = getDateRangeString('2025-12-31', '2026-01-01')
  assert.equal(out.includes('2025'), true)
  assert.equal(out.includes('2026'), true)
  assert.equal(out.includes(' - '), true)
})

await test('getDateRangeString returns empty string for invalid date input', () => {
  const out = getDateRangeString('not-a-date', '2026-01-01')
  assert.equal(out, '')
})

await test('validateInputWithRegex resolves true for matching input', async () => {
  const out = await validateInputWithRegex('abc123', /^[a-z]+\d+$/)
  assert.equal(out, true)
})

await test('validateInputWithRegex resolves false for empty input', async () => {
  const out = await validateInputWithRegex('', /^[a-z]+$/)
  assert.equal(out, false)
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
