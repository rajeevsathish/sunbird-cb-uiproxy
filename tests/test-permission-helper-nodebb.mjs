/**
 * Test: permissionHelper createNodeBBUser branches
 *
 * Run: npx tsx tests/test-permission-helper-nodebb.mjs
 */

import assert from 'node:assert/strict'
import http from 'node:http'

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

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

function close(server) {
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}

console.log('permission helper createNodeBBUser tests')

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/discussion/user/v1/create') {
    req.resume()
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ data: { result: { userId: { uid: 321 } } } }))
    })
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not-found' }))
})

const port = await listen(server)
process.env.KONG_API_BASE = `http://127.0.0.1:${port}`
process.env.SB_API_KEY = 'test-api-key'

const { PERMISSION_HELPER } = await import('../src/utils/permissionHelper.ts')

const reqObj = {
  kauth: {
    grant: {
      access_token: {
        token: 'user-token-for-nodebb',
      },
    },
  },
  session: {
    firstName: 'First',
    lastName: 'Last',
    userId: 'u-1',
    userName: 'first.last',
  },
}

await test('createNodeBBUser success calls setNodeBBUID with axios response', async () => {
  const original = PERMISSION_HELPER.setNodeBBUID
  let called = false

  PERMISSION_HELPER.setNodeBBUID = (r, cb, body) => {
    called = true
    assert.equal(r, reqObj)
    assert.equal(body.data.data.result.userId.uid, 321)
    cb(null, { ok: true })
  }

  const callbackArgs = await new Promise((resolve) => {
    PERMISSION_HELPER.createNodeBBUser(reqObj, (...args) => resolve(args))
  })

  assert.equal(called, true)
  assert.equal(callbackArgs[0], null)
  assert.deepEqual(callbackArgs[1], { ok: true })

  PERMISSION_HELPER.setNodeBBUID = original
})

await test('createNodeBBUser error path returns callback(null, null)', async () => {
  await close(server)

  const original = PERMISSION_HELPER.setNodeBBUID
  let called = false
  PERMISSION_HELPER.setNodeBBUID = () => {
    called = true
  }

  const callbackArgs = await new Promise((resolve) => {
    PERMISSION_HELPER.createNodeBBUser(reqObj, (...args) => resolve(args))
  })

  assert.equal(called, false)
  assert.equal(callbackArgs[0], null)
  assert.equal(callbackArgs[1], null)

  PERMISSION_HELPER.setNodeBBUID = original
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
