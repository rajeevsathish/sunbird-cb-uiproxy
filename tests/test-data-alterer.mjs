/**
 * Test: dataAlterer.ts
 *
 * Verifies flat and hierarchy transformations for contentType
 * mapping between Collection and CourseUnit.
 *
 * Run: npx tsx tests/test-data-alterer.mjs
 */

import assert from 'node:assert/strict'

const { returnData } = await import('../src/utils/dataAlterer.ts')

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

console.log('dataAlterer helper tests')

test('returns false for empty input', () => {
  assert.equal(returnData({}), false)
})

test('flat mode maps Collection to CourseUnit', () => {
  const payload = {
    result: {
      content: {
        contentType: 'Collection',
      },
    },
  }

  const out = returnData(payload, 'result')
  assert.equal(out.result.content.contentType, 'CourseUnit')
})

test('flat mode maps CourseUnit to Collection', () => {
  const payload = {
    result: {
      content: {
        contentType: 'CourseUnit',
      },
    },
  }

  const out = returnData(payload, 'result')
  assert.equal(out.result.content.contentType, 'Collection')
})

test('flat mode returns false when request object is null', () => {
  const payload = { result: null }
  const out = returnData(payload, 'result')
  assert.deepEqual(out, { result: false })
})

test('hierarchy request mode maps first matching node', () => {
  const payload = {
    request: {
      data: {
        hierarchy: {
          a1: { contentType: 'Resource' },
          a2: { contentType: 'Collection' },
          a3: { contentType: 'Collection' },
        },
      },
    },
  }

  const out = returnData(payload, null, 'hierarchy')
  assert.equal(out.request.data.hierarchy.a2.contentType, 'CourseUnit')
  // Function intentionally breaks after first replacement.
  assert.equal(out.request.data.hierarchy.a3.contentType, 'Collection')
})

test('hierarchy response mode maps all child Collection/CourseUnit values', () => {
  const payload = {
    params: { status: 'successful' },
    result: {
      content: {
        children: [
          { contentType: 'Collection' },
          { contentType: 'CourseUnit' },
          { contentType: 'Resource' },
        ],
      },
    },
  }

  const out = returnData(payload, null, 'hierarchy')
  assert.equal(out.result.content.children[0].contentType, 'CourseUnit')
  assert.equal(out.result.content.children[1].contentType, 'Collection')
  assert.equal(out.result.content.children[2].contentType, 'Resource')
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
