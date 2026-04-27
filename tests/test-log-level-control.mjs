import assert from 'node:assert/strict'

import envModule from '../src/utils/env.ts'
import logLevelControlModule from '../src/utils/logLevelControl.ts'
import loggerModule from '../src/utils/logger.ts'
import redisModule from '../src/utils/redis.ts'
import rolesModule from '../src/utils/roles.ts'

const { CONSTANTS } = envModule
const {
  getLogLevelHandler,
  resetLogLevelHandler,
  setLogLevelHandler,
  startLogLevelSync,
  stopLogLevelSync,
  syncLogLevelFromRedisOnce,
} = logLevelControlModule
const { getLogLevel, resetLogLevel, setLogLevel } = loggerModule
const { redis } = redisModule
const { ROLE } = rolesModule

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

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
}

console.log('logLevelControl tests')

const originalConstants = {
  LOG_LEVEL: CONSTANTS.LOG_LEVEL,
  LOG_LEVEL_POLL_INTERVAL_MS: CONSTANTS.LOG_LEVEL_POLL_INTERVAL_MS,
  LOG_LEVEL_REDIS_KEY: CONSTANTS.LOG_LEVEL_REDIS_KEY,
  LOG_LEVEL_SYNC_ENABLED: CONSTANTS.LOG_LEVEL_SYNC_ENABLED,
}
const originalRedisGet = redis.get.bind(redis)
const originalRedisSet = redis.set.bind(redis)
const originalSetInterval = global.setInterval
const originalClearInterval = global.clearInterval
const originalLevel = getLogLevel()

CONSTANTS.LOG_LEVEL_SYNC_ENABLED = 'true'
CONSTANTS.LOG_LEVEL_REDIS_KEY = 'ui_proxy_log_level'
CONSTANTS.LOG_LEVEL_POLL_INTERVAL_MS = 5

await test('syncLogLevelFromRedisOnce updates logger from redis when enabled', async () => {
  redis.get = async () => 'warn'
  setLogLevel('info')

  await syncLogLevelFromRedisOnce()

  assert.equal(getLogLevel(), 'warn')
})

await test('syncLogLevelFromRedisOnce ignores invalid redis level', async () => {
  redis.get = async () => 'invalid-level'
  setLogLevel('info')

  await syncLogLevelFromRedisOnce()

  assert.equal(getLogLevel(), 'info')
})

await test('getLogLevelHandler returns 403 for non-SPV admin users', async () => {
  const res = createResponse()
  const req = { session: { userRoles: [ROLE.PUBLIC] } }

  getLogLevelHandler(req, res)

  assert.equal(res.statusCode, 403)
  assert.equal(res.body.error, 'forbidden')
})

await test('getLogLevelHandler returns current logger metadata for SPV admin users', async () => {
  const res = createResponse()
  const req = { session: { userRoles: [ROLE.SPV_ADMIN] } }
  setLogLevel('debug')

  getLogLevelHandler(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.current, 'debug')
  assert.equal(res.body.redisKey, CONSTANTS.LOG_LEVEL_REDIS_KEY)
})

await test('setLogLevelHandler rejects invalid levels', async () => {
  const res = createResponse()
  const req = { body: { level: 'verbose' }, session: { userRoles: [ROLE.SPV_ADMIN] } }

  await setLogLevelHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'bad_request')
})

await test('setLogLevelHandler updates logger and persists to redis', async () => {
  const res = createResponse()
  const req = { body: { level: 'trace' }, session: { userRoles: [ROLE.SPV_ADMIN] } }
  const redisCalls = []
  redis.set = async (...args) => {
    redisCalls.push(args)
    return 'OK'
  }

  await setLogLevelHandler(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.current, 'trace')
  assert.deepEqual(redisCalls[0], [CONSTANTS.LOG_LEVEL_REDIS_KEY, 'trace'])
})

await test('resetLogLevelHandler resets logger and persists default level', async () => {
  const res = createResponse()
  const req = { session: { userRoles: [ROLE.SPV_ADMIN] } }
  const redisCalls = []
  setLogLevel('fatal')
  redis.set = async (...args) => {
    redisCalls.push(args)
    return 'OK'
  }

  await resetLogLevelHandler(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.current, getLogLevel())
  assert.deepEqual(redisCalls[0], [CONSTANTS.LOG_LEVEL_REDIS_KEY, String(CONSTANTS.LOG_LEVEL || 'error')])
})

await test('startLogLevelSync schedules polling and stopLogLevelSync clears it', async () => {
  const timerToken = { id: 'timer-1' }
  const setCalls = []
  const clearCalls = []
  redis.get = async () => null
  global.setInterval = (fn, delay) => {
    setCalls.push({ fn, delay })
    return timerToken
  }
  global.clearInterval = (token) => {
    clearCalls.push(token)
  }

  startLogLevelSync()
  stopLogLevelSync()

  assert.equal(setCalls.length, 1)
  assert.equal(setCalls[0].delay, 5)
  assert.deepEqual(clearCalls, [timerToken])
})

redis.get = originalRedisGet
redis.set = originalRedisSet
global.setInterval = originalSetInterval
global.clearInterval = originalClearInterval
CONSTANTS.LOG_LEVEL = originalConstants.LOG_LEVEL
CONSTANTS.LOG_LEVEL_POLL_INTERVAL_MS = originalConstants.LOG_LEVEL_POLL_INTERVAL_MS
CONSTANTS.LOG_LEVEL_REDIS_KEY = originalConstants.LOG_LEVEL_REDIS_KEY
CONSTANTS.LOG_LEVEL_SYNC_ENABLED = originalConstants.LOG_LEVEL_SYNC_ENABLED
setLogLevel(originalLevel)
resetLogLevel()

console.log(`\n${'─'.repeat(50)}`)
console.log(`${passed} passed, ${failed} failed`)

if (failed > 0) {
  console.log('❌ FAIL')
  process.exit(1)
} else {
  console.log('✅ ALL PASS')
  process.exit(0)
}