/**
 * Test: whitelist API registry integrity.
 *
 * Focus:
 * 1. Validate all configured API calls in API_LIST.URL.
 * 2. Validate all URL patterns in API_LIST.URL_PATTERN.
 * 3. Ensure check contracts are structurally valid.
 */

import assert from 'node:assert/strict'

import whitelistApisModule from '../src/utils/whitelistApis.ts'
import rolesModule from '../src/utils/roles.ts'

const { API_LIST } = whitelistApisModule
const { ROLE } = rolesModule

const { pathToRegexp } = await import('path-to-regexp')

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

const SUPPORTED_CHECKS = new Set(['ROLE_CHECK', 'SCOPE_CHECK', 'PARAM_EQUALITY_CHECK'])
const VALID_ROLE_VALUES = new Set([...Object.values(ROLE), 'ALL'])

console.log('Whitelist registry tests')

test('API_LIST.URL and API_LIST.URL_PATTERN are non-empty', () => {
  assert.ok(API_LIST.URL)
  assert.ok(Array.isArray(API_LIST.URL_PATTERN))
  assert.ok(Object.keys(API_LIST.URL).length > 0)
  assert.ok(API_LIST.URL_PATTERN.length > 0)
})

test('every URL key compiles as a valid path-to-regexp pattern', () => {
  const urls = Object.keys(API_LIST.URL)
  for (const url of urls) {
    assert.doesNotThrow(() => pathToRegexp(url), `invalid URL key pattern: ${url}`)
  }
})

test('every URL_PATTERN entry compiles as a valid path-to-regexp pattern', () => {
  for (const pattern of API_LIST.URL_PATTERN) {
    assert.equal(typeof pattern, 'string', 'pattern must be a string')
    assert.ok(pattern.startsWith('/'), `pattern must start with '/': ${pattern}`)
    assert.doesNotThrow(() => pathToRegexp(pattern), `invalid URL_PATTERN: ${pattern}`)
  }
})

test('every URL config has checksNeeded and valid check definitions', () => {
  const urls = Object.keys(API_LIST.URL)

  for (const url of urls) {
    const rule = API_LIST.URL[url]

    assert.ok(rule && typeof rule === 'object', `rule must be object for ${url}`)
    assert.ok(Array.isArray(rule.checksNeeded), `checksNeeded must be array for ${url}`)

    for (const checkName of rule.checksNeeded) {
      assert.ok(SUPPORTED_CHECKS.has(checkName), `unsupported check ${checkName} in ${url}`)
      assert.ok(checkName in rule, `missing ${checkName} config in ${url}`)

      if (checkName === 'ROLE_CHECK' || checkName === 'SCOPE_CHECK') {
        const roleList = rule[checkName]
        assert.ok(Array.isArray(roleList), `${checkName} must be an array in ${url}`)
        assert.ok(roleList.length > 0, `${checkName} cannot be empty in ${url}`)
        for (const role of roleList) {
          assert.ok(VALID_ROLE_VALUES.has(role), `invalid role '${role}' in ${checkName} for ${url}`)
        }
      }

      if (checkName === 'PARAM_EQUALITY_CHECK') {
        const paramCheck = rule.PARAM_EQUALITY_CHECK
        assert.ok(paramCheck && typeof paramCheck === 'object', `PARAM_EQUALITY_CHECK must be object in ${url}`)
        assert.ok(Array.isArray(paramCheck.checks), `PARAM_EQUALITY_CHECK.checks must be array in ${url}`)
        assert.ok(paramCheck.checks.length > 0, `PARAM_EQUALITY_CHECK.checks cannot be empty in ${url}`)
      }
    }
  }
})

test('all API calls are tracked between URL and URL_PATTERN (known drift only)', () => {
  const urls = Object.keys(API_LIST.URL)
  const patterns = API_LIST.URL_PATTERN
  const urlSet = new Set(urls)
  const patternSet = new Set(patterns)

  const missingInPatterns = urls.filter((u) => patternSet.has(u) === false).sort()
  const missingInUrls = patterns.filter((p) => urlSet.has(p) === false).sort()

  const expectedMissingInPatterns = [
    '/protected/v8/internal/log-level',
    '/protected/v8/internal/log-level/reset',
    '/proxies/v8/comment/v2search',
    '/proxies/v8/connections/v2/connections/requests/blocked',
    '/proxies/v8/connections/v3/connections/recommended',
    '/proxies/v8/connections/v3/connections/recommended/mentors',
    '/proxies/v8/discussion/forum/v3/create',
    '/proxies/v8/otp/v1/verify',
    '/proxies/v8/private/mlsurvey/api/v1/admin/dbFind/solutions',
    '/proxies/v8/storage/orgStoreUpload',
  ]

  const expectedMissingInUrls = [
    '/protected/v8/connections/v2/connections/requests/blocked',
    '/protected/v8/connections/v3/connections/recommended',
    '/protected/v8/connections/v3/connections/recommended/mentors',
    '/proxies/v8/careers/v4/retire/:do_id',
    '/proxies/v8/otp/v1/otp',
    '/proxies/v8/private/mlcore/api/v1/admin/dbFind/solutions',
  ]

  assert.deepEqual(missingInPatterns, expectedMissingInPatterns)
  assert.deepEqual(missingInUrls, expectedMissingInUrls)
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
