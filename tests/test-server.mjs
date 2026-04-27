/**
 * Test: server.ts middleware wiring and handler behavior.
 *
 * Focus:
 * 1. setCookie middleware sets rootorg cookie only for localhost.
 * 2. resetCookies handler computes domain and clears session/cookies correctly.
 */

import assert from 'node:assert/strict'

import serverModule from '../src/server.ts'

const { Server } = serverModule

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

function createAppStub() {
  const uses = []
  return {
    uses,
    use(...args) {
      uses.push(args)
      return this
    },
    get() {
      return this
    },
    post() {
      return this
    },
    all() {
      return this
    },
  }
}

console.log('server.ts tests')

test('setCookie registers rootorg middleware that sets cookie on localhost', () => {
  const app = createAppStub()
  const ctx = { app }

  Server.prototype.setCookie.call(ctx)

  assert.ok(app.uses.length >= 2, 'expected setCookie to register at least two middleware entries')

  const rootOrgMiddleware = app.uses[1][0]
  assert.equal(typeof rootOrgMiddleware, 'function')

  let nextCalled = false
  const req = {
    headers: { rootOrg: 'igot' },
    hostname: 'localhost',
  }
  const res = {
    cookieCalls: [],
    cookie(name, value) {
      this.cookieCalls.push({ name, value })
    },
  }

  rootOrgMiddleware(req, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, true)
  assert.deepEqual(res.cookieCalls, [{ name: 'rootorg', value: 'igot' }])
})

test('setCookie rootorg middleware does not set cookie for non-localhost hostnames', () => {
  const app = createAppStub()
  const ctx = { app }

  Server.prototype.setCookie.call(ctx)

  const rootOrgMiddleware = app.uses[1][0]
  const req = {
    headers: { rootOrg: 'igot' },
    hostname: 'portal.karmayogi.nic.in',
  }
  const res = {
    cookieCalls: [],
    cookie(name, value) {
      this.cookieCalls.push({ name, value })
    },
  }

  rootOrgMiddleware(req, res, () => {})
  assert.equal(res.cookieCalls.length, 0)
})

test('resetCookies clears cookies for localhost and redirects after session destroy', () => {
  const app = createAppStub()
  const ctx = { app }

  Server.prototype.resetCookies.call(ctx)

  const resetRegistration = app.uses.find((entry) => entry[0] === '/reset')
  assert.ok(resetRegistration, 'expected /reset route registration')

  const handler = resetRegistration[1]
  assert.equal(typeof handler, 'function')

  const req = {
    get(header) {
      if (header === 'host') {
        return 'localhost:3003'
      }
      return ''
    },
    session: {
      destroy(cb) {
        cb()
      },
    },
    cookies: {},
  }

  const res = {
    clearCalls: [],
    redirectPath: null,
    clearCookie(name, opts) {
      this.clearCalls.push({ name, opts })
    },
    redirect(path) {
      this.redirectPath = path
    },
  }

  handler(req, res)

  assert.equal(res.clearCalls.length, 2)
  assert.deepEqual(res.clearCalls[0], {
    name: 'connect.sid',
    opts: { httpOnly: true, secure: true },
  })
  assert.deepEqual(res.clearCalls[1], {
    name: 'connect.sid',
    opts: { domain: 'localhost', httpOnly: false, path: '/', secure: true },
  })
  assert.equal(res.redirectPath, '/apis/logout')
})

test('resetCookies computes dotted domain for non-localhost hostnames', () => {
  const app = createAppStub()
  const ctx = { app }

  Server.prototype.resetCookies.call(ctx)

  const resetRegistration = app.uses.find((entry) => entry[0] === '/reset')
  const handler = resetRegistration[1]

  const req = {
    get(header) {
      if (header === 'host') {
        return 'portal.karmayogi.nic.in'
      }
      return ''
    },
    session: {
      destroy(cb) {
        cb()
      },
    },
    cookies: {},
  }

  const res = {
    clearCalls: [],
    redirectPath: null,
    clearCookie(name, opts) {
      this.clearCalls.push({ name, opts })
    },
    redirect(path) {
      this.redirectPath = path
    },
  }

  handler(req, res)

  assert.equal(res.clearCalls[1].opts.domain, '.karmayogi.nic.in')
  assert.equal(res.redirectPath, '/apis/logout')
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
