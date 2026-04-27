import assert from 'node:assert/strict'

import loggerModule from '../src/utils/logger.ts'

const {
  getLogLevel,
  isValidLogLevel,
  log,
  logDebug,
  logError,
  logErrorHeading,
  logInfo,
  logInfoHeading,
  logObject,
  logSuccess,
  logSuccessHeading,
  logWarn,
  logWarnHeading,
  resetLogLevel,
  setLogLevel,
} = loggerModule

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

console.log('logger tests')

test('isValidLogLevel accepts only supported levels', () => {
  assert.equal(isValidLogLevel('debug'), true)
  assert.equal(isValidLogLevel('silent'), true)
  assert.equal(isValidLogLevel('verbose'), false)
  assert.equal(isValidLogLevel(10), false)
})

test('setLogLevel and resetLogLevel manage logger state', () => {
  const originalLevel = getLogLevel()
  setLogLevel('trace')
  assert.equal(getLogLevel(), 'trace')
  resetLogLevel()
  assert.notEqual(getLogLevel(), '')
  setLogLevel(originalLevel)
})

test('logObject handles sorted object formatting without throwing', () => {
  assert.doesNotThrow(() => {
    logObject('prefix', { zebra: true, alpha: 1, beta: null })
  })
})

test('basic logger helpers execute without throwing', () => {
  assert.doesNotThrow(() => {
    log('plain log')
    logInfoHeading('Info Heading')
    logInfo('a', 'b')
    logDebug('debug message')
    logWarnHeading('Warn Heading')
    logWarn('warn message')
    logErrorHeading('Error Heading')
    logError('error message')
    logSuccessHeading('Success Heading')
    logSuccess('success message')
  })
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