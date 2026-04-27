import assert from 'node:assert/strict'
import axios from 'axios'

import discussionHelperModule from '../src/utils/discussionHub-helper.ts'
import envModule from '../src/utils/env.ts'
import fileLoggerModule from '../src/utils/fileLogger.ts'
import redisModule from '../src/utils/redis.ts'
import testModule from '../src/utils/test.ts'

const { CONSTANTS, RESTRICTED_PYTHON_STMT } = envModule
const { getUserUIDBySession, getWriteApiAdminUID, getWriteApiToken } = discussionHelperModule
const { pino } = fileLoggerModule
const { redis } = redisModule
const { test: sampleTestObject } = testModule

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

console.log('misc utils tests')

await test('env exports core constants and restricted statements array', async () => {
  assert.equal(typeof CONSTANTS.HTTPS_HOST, 'string')
  assert.equal(typeof CONSTANTS.KEYCLOAK_REALM, 'string')
  assert.ok(Array.isArray(RESTRICTED_PYTHON_STMT))
})

await test('discussion helper returns bearer token and numeric admin uid', async () => {
  assert.equal(getWriteApiToken(), `Bearer ${CONSTANTS.DISCUSSION_HUB_WRITE_API_KEY}`)
  assert.equal(getWriteApiAdminUID(), Number(CONSTANTS.DISCUSSION_HUB_WRITE_API_UID))
})

await test('discussion helper reads uid from session', async () => {
  const uid = await getUserUIDBySession({ session: { uid: 777 } })
  assert.equal(uid, 777)
})

await test('fileLogger exports a writable pino logger instance', async () => {
  assert.equal(typeof pino.info, 'function')
  assert.doesNotThrow(() => {
    pino.info('file logger smoke test')
  })
})

await test('redis export exposes client methods', async () => {
  assert.equal(typeof redis.on, 'function')
  assert.equal(typeof redis.get, 'function')
  assert.equal(typeof redis.set, 'function')
})

await test('test.ts exports the expected sample object', async () => {
  assert.deepEqual(sampleTestObject, {
    key: 'a',
    key1: 'b',
    key2: 'c',
  })
})

await test('axios-retry registers a response interceptor and retries eligible requests', async () => {
  const initialCount = axios.interceptors.response.handlers.length
  const originalAdapter = axios.defaults.adapter
  await import('../src/utils/axios-retry.ts')

  assert.equal(axios.interceptors.response.handlers.length, initialCount + 1)
  const handler = axios.interceptors.response.handlers[axios.interceptors.response.handlers.length - 1]

  const lowStatusError = { config: { retry: 2 }, response: { status: 400 } }
  await assert.rejects(() => handler.rejected(lowStatusError), (err) => err === lowStatusError)

  const noRetryError = { config: {}, response: { status: 500 } }
  await assert.rejects(() => handler.rejected(noRetryError), (err) => err === noRetryError)

  const maxRetryError = { code: '500', config: { retry: 1, __retryCount: 1 }, response: { status: 500 } }
  await assert.rejects(() => handler.rejected(maxRetryError), (err) => err.code === '404')

  axios.defaults.adapter = async (config) => ({
    config,
    data: { ok: true },
    headers: {},
    status: 200,
    statusText: 'OK',
  })

  const retryError = {
    config: { method: 'get', retry: 1, retryDelay: 0, url: 'http://retry.local' },
    response: { status: 500 },
  }
  const response = await handler.rejected(retryError)
  assert.equal(response.status, 200)
  assert.equal(retryError.config.__retryCount, 1)

  axios.defaults.adapter = originalAdapter
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