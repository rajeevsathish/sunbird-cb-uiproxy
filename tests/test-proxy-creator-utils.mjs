import assert from 'node:assert/strict'

import proxyCreatorModule from '../src/utils/proxyCreator.ts'

const {
  buildProxyBuffer,
  createPooledProxy,
  proxyCreatorRoute,
  proxyHeaders,
} = proxyCreatorModule

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

async function readStream(stream) {
  return new Promise((resolve, reject) => {
    let result = ''
    stream.on('data', (chunk) => {
      result += chunk.toString()
    })
    stream.on('end', () => resolve(result))
    stream.on('error', reject)
  })
}

console.log('proxyCreator utility tests')

await test('buildProxyBuffer returns undefined when request body is absent', async () => {
  const req = { headers: {}, method: 'GET' }
  assert.equal(buildProxyBuffer(req), undefined)
})

await test('buildProxyBuffer serializes regular JSON bodies and sets content-length', async () => {
  const req = {
    body: { a: 1, b: 'two' },
    headers: { 'transfer-encoding': 'chunked' },
    method: 'POST',
    originalUrl: '/some/api',
  }

  const buffer = buildProxyBuffer(req)

  assert.ok(buffer)
  assert.equal(req.headers['transfer-encoding'], undefined)
  assert.equal(req.headers['content-length'], String(Buffer.byteLength(JSON.stringify(req.body))))
  assert.equal(await readStream(buffer), JSON.stringify(req.body))
})

await test('buildProxyBuffer emits explicit empty object for mutating empty payloads', async () => {
  const req = {
    body: {},
    headers: { 'transfer-encoding': 'chunked' },
    method: 'PATCH',
    originalUrl: '/some/api',
  }

  const buffer = buildProxyBuffer(req)

  assert.ok(buffer)
  assert.equal(req.headers['content-length'], '2')
  assert.equal(await readStream(buffer), '{}')
})

await test('buildProxyBuffer skips upload exclusions to preserve raw streams', async () => {
  const req = {
    body: { file: 'data' },
    headers: {},
    method: 'POST',
    originalUrl: '/storage/upload',
  }

  assert.equal(buildProxyBuffer(req), undefined)
})

await test('proxyHeaders injects authenticated headers and discussion uid', async () => {
  const req = {
    body: { title: 'topic' },
    headers: {},
    originalUrl: '/discussion/topic/123',
    header(name) {
      return this.headers[name.toLowerCase()] || this.headers[name]
    },
    kauth: {
      grant: {
        access_token: {
          content: {
            email: 'user@example.com',
            preferred_username: 'user@example.com',
            sub: 'a:b:user-1',
          },
          token: 'token-123',
        },
      },
    },
    session: {
      channel: 'igot',
      cookie: { secure: false },
      rootOrgId: 'root-org',
      uid: '42',
      userRoles: ['PUBLIC'],
    },
  }

  let nextCalled = false
  proxyHeaders(req, {}, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, true)
  assert.equal(req.headers['x-channel-id'], 'root-org')
  assert.equal(req.headers['x-authenticated-user-token'], 'token-123')
  assert.equal(req.headers['x-authenticated-userid'], 'user-1')
  assert.equal(req.headers['x-authenticated-user-nodebb-uid'], '42')
  assert.equal(req.body._uid, '42')
  assert.equal(req.session.cookie.secure, true)
})

await test('createPooledProxy returns a proxy instance with web method', async () => {
  const proxy = createPooledProxy({})
  assert.equal(typeof proxy.web, 'function')
})

await test('proxyCreatorRoute registers catch-all route handler', async () => {
  const calls = []
  const route = {
    all(...args) {
      calls.push(args)
      return this
    },
  }

  const returned = proxyCreatorRoute(route, 'https://example.org')

  assert.equal(returned, route)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], '/*')
  assert.equal(typeof calls[0][1], 'function')
  assert.equal(typeof calls[0][2], 'function')
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