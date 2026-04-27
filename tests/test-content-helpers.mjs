import assert from 'node:assert/strict'

import contentHelpersModule from '../src/utils/contentHelpers.ts'

const {
  appendProxiesUrl,
  appendUrl,
  getMinimalContent,
  processContent,
  processDisplayContentType,
  processDownloadUrl,
  processUrl,
  shuffleContent,
} = contentHelpersModule

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

console.log('contentHelpers tests')

test('processContent returns falsy input as-is', () => {
  assert.equal(processContent(null), null)
})

test('processContent normalizes urls, children and booleans', () => {
  const input = {
    appIcon: 'http://private-content/icon.png',
    artifactUrl: 'http://private-content/file.pdf',
    children: [
      {
        appIcon: 'http://private-child/icon.png',
        artifactUrl: '',
        contentType: 'Course',
        downloadUrl: 'http://private-child/download',
        introductoryVideo: 'http://private-child/video',
        introductoryVideoIcon: '',
        isExternal: false,
        playgroundResources: [],
        resourceType: 'Learning Path',
        subTitles: [],
      },
    ],
    contentType: 'Resource',
    downloadUrl: 'http://private-content/download',
    introductoryVideo: 'http://private-content/intro.mp4',
    introductoryVideoIcon: 'http://private-content/intro.png',
    isExternal: 'yes',
    playgroundResources: [{ artifactUrl: 'http://private-content/playground.zip' }],
    resourceType: 'Module',
    subTitles: [{ url: 'http://private-content/subtitle.vtt' }],
  }

  const result = processContent(input)

  assert.equal(result.appIcon, '/apis/proxies/v8/icon.png')
  assert.equal(result.artifactUrl, '/apis/proxies/v8/file.pdf')
  assert.equal(result.downloadUrl, '/apis/proxies/v8/download')
  assert.equal(result.introductoryVideo, '/apis/proxies/v8/intro.mp4')
  assert.equal(result.introductoryVideoIcon, '/apis/proxies/v8/intro.png')
  assert.equal(result.displayContentType, 'Module')
  assert.equal(result.isExternal, true)
  assert.equal(result.playgroundResources[0].artifactUrl, '/apis/proxies/v8/playground.zip')
  assert.equal(result.subTitles[0].url, '/apis/proxies/v8/subtitle.vtt')
  assert.equal(result.children[0].downloadUrl, '/apis/proxies/v8/download')
  assert.equal(result.children[0].displayContentType, 'Learning Path')
})

test('shuffleContent uses in-place Fisher-Yates logic', () => {
  const originalRandom = Math.random
  Math.random = () => 0
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  try {
    const result = shuffleContent(items)
    assert.equal(result, items)
    assert.deepEqual(result.map((item) => item.id), ['b', 'c', 'a'])
  } finally {
    Math.random = originalRandom
  }
})

test('getMinimalContent maps the expected subset and creator fallback', () => {
  const result = getMinimalContent({
    appIcon: 'http://private-content/icon.png',
    artifactUrl: '/artifact',
    complexityLevel: 'easy',
    contentType: 'Course',
    creatorContacts: [{ name: 'Fallback' }],
    description: 'desc',
    duration: 10,
    identifier: 'do_123',
    learningMode: 'Self-paced',
    mimeType: 'application/pdf',
    name: 'Course 1',
    resourceType: 'Program',
    status: 'Live',
  })

  assert.equal(result.appIcon, '/apis/proxies/v8/icon.png')
  assert.equal(result.displayContentType, 'Program')
  assert.deepEqual(result.creatorDetails, [{ name: 'Fallback' }])
})

test('url helper functions transform routes consistently', () => {
  assert.equal(processUrl('http://private-domain/path/file'), '/apis/proxies/v8/path/file')
  assert.equal(processUrl(undefined), '')
  assert.equal(appendUrl('/content/path'), '/apis/proxies/v8/content/path')
  assert.equal(appendProxiesUrl('img.png'), '/apis/proxies/v8/web-hosted/navigator/images/img.png')
  assert.equal(processDisplayContentType('Course', 'Module'), 'Module')
  assert.equal(processDisplayContentType('Course'), 'Course')
  assert.equal(processDownloadUrl('http://private-domain/path/file'), '/apis/proxies/v8/path/file')
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