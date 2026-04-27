/**
 * Test: apiWhiteList middleware behavior.
 *
 * Focus:
 * 1. isAllowed: static bypass, whitelist allow/deny, pattern resolution.
 * 2. apiWhiteListLogger: static bypass, unauthenticated deny, whitelist validation.
 */

import assert from 'node:assert/strict'

process.env.PORTAL_API_WHITELIST_CHECK = 'true'

import apiWhiteListModule from '../src/utils/apiWhiteList.ts'
import rolesModule from '../src/utils/roles.ts'

const { isAllowed, apiWhiteListLogger } = apiWhiteListModule
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

function createReq(path, overrides = {}) {
  return {
    path,
    query: {},
    body: {},
    session: { userRoles: [ROLE.PUBLIC] },
    get: (header) => {
      if (header === 'host') {
        return 'localhost:3003'
      }
      return ''
    },
    ...overrides,
  }
}

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    ended: false,
    status(code) {
      this.statusCode = code
      return this
    },
    setHeader(k, v) {
      this.headers[k] = v
    },
    send(body) {
      this.payload = body
      return this
    },
    end() {
      this.ended = true
      return this
    },
  }
}

function runMiddleware(middleware, req) {
  const res = createRes()
  return new Promise((resolve, reject) => {
    let settled = false

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error('middleware timeout'))
      }
    }, 1500)

    const next = () => {
      if (settled) {
        return
      }
      clearTimeout(timer)
      settled = true
      resolve({ nextCalled: true, res })
    }

    const originalEnd = res.end.bind(res)
    res.end = () => {
      originalEnd()
      if (!settled) {
        clearTimeout(timer)
        settled = true
        resolve({ nextCalled: false, res })
      }
      return res
    }

    try {
      middleware(req, res, next)
    } catch (err) {
      clearTimeout(timer)
      reject(err)
    }
  })
}

console.log('apiWhiteList middleware tests')

await test('isAllowed bypasses static route', async () => {
  const middleware = isAllowed()
  const req = createReq('/assets/app.js')
  const { nextCalled, res } = await runMiddleware(middleware, req)
  assert.equal(nextCalled, true)
  assert.equal(res.statusCode, 200)
})

await test('isAllowed rejects unknown route with 403', async () => {
  const middleware = isAllowed()
  const req = createReq('/not-whitelisted/endpoint')
  const { nextCalled, res } = await runMiddleware(middleware, req)
  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 403)
})

await test('isAllowed allows known route with matching role', async () => {
  const middleware = isAllowed()
  const req = createReq('/protected/v8/user/details', {
    session: { userRoles: [ROLE.PUBLIC] },
  })

  const { nextCalled, res } = await runMiddleware(middleware, req)
  assert.equal(nextCalled, true)
  assert.equal(res.statusCode, 200)
})

await test('isAllowed rejects known route with non-matching role', async () => {
  const middleware = isAllowed()
  const req = createReq('/protected/v8/internal/log-level', {
    session: { userRoles: [ROLE.PUBLIC] },
  })

  const { nextCalled, res } = await runMiddleware(middleware, req)
  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 403)
})

await test('isAllowed resolves parameterized routes via URL pattern cache', async () => {
  const middleware = isAllowed()
  const req = createReq('/proxies/v8/api/user/v2/read/user-123', {
    session: { userRoles: [ROLE.PUBLIC] },
  })

  const { nextCalled, res } = await runMiddleware(middleware, req)
  assert.equal(nextCalled, true)
  assert.equal(res.statusCode, 200)
})

await test('apiWhiteListLogger bypasses root path', async () => {
  const middleware = apiWhiteListLogger()
  const req = createReq('/')

  const { nextCalled, res } = await runMiddleware(middleware, req)
  assert.equal(nextCalled, true)
  assert.equal(res.statusCode, 200)
})

await test('apiWhiteListLogger responds 419 when session has no userRoles', async () => {
  const middleware = apiWhiteListLogger()
  const req = createReq('/protected/v8/user/details', {
    session: {},
  })

  const { nextCalled, res } = await runMiddleware(middleware, req)
  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 419)
})

await test('apiWhiteListLogger validates whitelist and allows known route', async () => {
  const middleware = apiWhiteListLogger()
  const req = createReq('/proxies/v8/api/user/v2/read/user-123', {
    session: { userRoles: [ROLE.PUBLIC] },
  })

  const { nextCalled, res } = await runMiddleware(middleware, req)
  assert.equal(nextCalled, true)
  assert.equal(res.statusCode, 200)
})

await test('apiWhiteListLogger rejects unknown non-static route with 403', async () => {
  const middleware = apiWhiteListLogger()
  const req = createReq('/protected/v8/unknown/endpoint', {
    session: { userRoles: [ROLE.PUBLIC] },
  })

  const { nextCalled, res } = await runMiddleware(middleware, req)
  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 403)
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
