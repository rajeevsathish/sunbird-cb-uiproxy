/**
 * Test: permissionHelper.ts + roles.ts + message.ts
 *
 * Run: npx tsx tests/test-permission-helper.mjs
 */

import assert from 'node:assert/strict'

const { PERMISSION_HELPER } = await import('../src/utils/permissionHelper.ts')
const { request } = await import('../src/utils/request-adapter.ts')
const { ROLE } = await import('../src/utils/roles.ts')
const { ERROR } = await import('../src/utils/message.ts')

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

function withCallback() {
  let resolve
  const promise = new Promise((res) => {
    resolve = res
  })
  const cb = (...args) => resolve(args)
  return { cb, promise }
}

console.log('permission helper + constants tests')

const originalCreateNodeBBUser = PERMISSION_HELPER.createNodeBBUser
const originalRequestGet = request.get

await test('ROLE contains expected baseline roles', () => {
  assert.equal(ROLE.PUBLIC, 'PUBLIC')
  assert.equal(ROLE.SPV_ADMIN, 'SPV_ADMIN')
  assert.equal(typeof ROLE.CONTENT_CREATOR, 'string')
})

await test('ERROR constants expose expected keys', () => {
  assert.equal(ERROR.ERROR_NO_ORG_DATA, 'ERROR_NO_ORG_DATA')
  assert.equal(ERROR.GENERAL_ERR_MSG, 'Failed due to unknown reason')
  assert.equal(typeof ERROR.ERROR_NO_AUTHORIZATION, 'string')
})

await test('setRolesData populates session fields and appends PUBLIC role', async () => {
  const reqObj = {
    session: {
      save: (cb) => cb(null),
    },
  }

  const responsePayload = {
    result: {
      response: {
        channel: 'test-channel',
        firstName: 'First',
        id: 'user-1',
        lastName: 'Last',
        organisations: [{ organisationId: 'org1', roles: ['R1'] }],
        profileDetails: { userRoles: ['POSITION_1'] },
        roles: ['CONTENT_CREATOR'],
        rootOrgId: 'root-1',
        userName: 'first.last',
      },
    },
  }

  PERMISSION_HELPER.createNodeBBUser = (_req, cb) => cb(null, { ok: true })
  const { cb, promise } = withCallback()

  PERMISSION_HELPER.setRolesData(reqObj, cb, JSON.stringify(responsePayload))
  await promise

  assert.equal(reqObj.session.userId, 'user-1')
  assert.equal(reqObj.session.userName, 'first.last')
  assert.equal(reqObj.session.rootOrgId, 'root-1')
  assert.equal(Array.isArray(reqObj.session.userRoles), true)
  assert.equal(reqObj.session.userRoles.includes('PUBLIC'), true)
  assert.deepEqual(reqObj.session.userPositions, ['POSITION_1'])
})

await test('setRolesData sets empty userPositions when profileDetails absent', async () => {
  const reqObj = {
    session: {
      save: (cb) => cb(null),
    },
  }

  const responsePayload = {
    result: {
      response: {
        channel: 'test-channel',
        firstName: 'First',
        id: 'user-2',
        lastName: 'Last',
        organisations: [],
        roles: ['PUBLIC'],
        rootOrgId: 'root-1',
        userName: 'user.two',
      },
    },
  }

  PERMISSION_HELPER.createNodeBBUser = (_req, cb) => cb(null, { ok: true })
  const { cb, promise } = withCallback()

  PERMISSION_HELPER.setRolesData(reqObj, cb, JSON.stringify(responsePayload))
  await promise

  assert.deepEqual(reqObj.session.userPositions, [])
  assert.equal(reqObj.session.userRoles.filter((r) => r === 'PUBLIC').length, 1)
})

await test('setRolesData returns callback error when session is missing', async () => {
  const reqObj = {}
  const { cb, promise } = withCallback()

  PERMISSION_HELPER.setRolesData(reqObj, cb, JSON.stringify({ result: { response: {} } }))
  const args = await promise

  assert.equal(args[0], 'reqObj.session no session')
  assert.equal(args[1], null)
})

await test('setNodeBBUID stores uid and returns response on save success', async () => {
  const reqObj = {
    session: {
      save: (cb) => cb(null),
    },
  }
  const body = {
    data: {
      result: {
        userId: {
          uid: 456,
        },
      },
    },
  }

  const { cb, promise } = withCallback()
  PERMISSION_HELPER.setNodeBBUID(reqObj, cb, body)
  const args = await promise

  assert.equal(reqObj.session.uid, 456)
  assert.equal(args[0], null)
  assert.deepEqual(args[1], body)
})

await test('setNodeBBUID returns null payload on save failure', async () => {
  const reqObj = {
    session: {
      save: (cb) => cb(new Error('save-failed')),
    },
  }
  const body = {
    data: {
      result: {
        userId: {
          uid: 999,
        },
      },
    },
  }

  const { cb, promise } = withCallback()
  PERMISSION_HELPER.setNodeBBUID(reqObj, cb, body)
  const args = await promise

  assert.equal(args[0], null)
  assert.equal(args[1], null)
})

await test('getCurrentUserRoles reads profile and updates session on OK response', async () => {
  const reqObj = {
    kauth: { grant: { access_token: { token: 'user-token' } } },
    session: {
      save: (cb) => cb(null),
      userId: 'user-123',
    },
  }

  request.get = (_opts, cb) => {
    const body = JSON.stringify({
      responseCode: 'OK',
      result: {
        response: {
          channel: 'channel-1',
          firstName: 'First',
          lastName: 'Last',
          organisations: [],
          roles: ['MDO_ADMIN'],
          rootOrgId: 'root-9',
          userId: 'user-123',
          userName: 'u123',
        },
      },
    })
    cb(null, null, body)
  }

  PERMISSION_HELPER.createNodeBBUser = (_req, cb) => cb(null, { ok: true })

  const { cb, promise } = withCallback()
  PERMISSION_HELPER.getCurrentUserRoles(reqObj, cb)
  await promise

  assert.equal(reqObj.session.userId, 'user-123')
  assert.equal(reqObj.session.userName, 'u123')
  assert.equal(reqObj.session.userRoles.includes('PUBLIC'), true)
})

await test('getCurrentUserRoles returns error when upstream responseCode is not OK', async () => {
  const reqObj = {
    kauth: { grant: { access_token: { token: 'user-token' } } },
    session: {
      userId: 'user-404',
    },
  }

  request.get = (_opts, cb) => {
    cb(null, null, JSON.stringify({ responseCode: 'FAILED' }))
  }

  const { cb, promise } = withCallback()
  PERMISSION_HELPER.getCurrentUserRoles(reqObj, cb)
  const args = await promise

  assert.equal(String(args[0]).includes('Failed to read the user with Id: user-404'), true)
  assert.equal(args[1], null)
})

await test('getCurrentUserRoles returns transport error when request.get fails', async () => {
  const reqObj = {
    kauth: { grant: { access_token: { token: 'user-token' } } },
    session: {
      userId: 'user-500',
    },
  }

  request.get = (_opts, cb) => {
    cb(new Error('network-failed'), null, null)
  }

  const { cb, promise } = withCallback()
  PERMISSION_HELPER.getCurrentUserRoles(reqObj, cb)
  const args = await promise

  assert.equal(String(args[0]).includes('network-failed'), true)
  assert.equal(args[1], null)
})

PERMISSION_HELPER.createNodeBBUser = originalCreateNodeBBUser
request.get = originalRequestGet

console.log(`\n${'─'.repeat(50)}`)
console.log(`${passed} passed, ${failed} failed`)

if (failed > 0) {
  console.log('❌ FAIL')
  process.exit(1)
} else {
  console.log('✅ ALL PASS')
  process.exit(0)
}
